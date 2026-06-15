# Design: Publicaciones — One Unified Content Table, Drafts Gated by RLS

One table `public.publicaciones` carries every editorial surface: a standalone blog feed, per-tema didactic content, and per-SI content are the **same** rows read through different FK filters (`tema_id`, `clasificacion_si_id`, or neither). The architecture is deliberately conservative — it mirrors live patterns in migrations `005` (RLS + `puede_gestionar_contenido()`), `006` (`clasificaciones_si.enlaces` jsonb), `007` (slug UNIQUE guarded by `pg_constraint`), and `009` (atomic content migration) — but introduces four net-new pieces the codebase has never had: a draft/published lifecycle whose SELECT policy must **filter drafts** (the one deviation from the `qual = true` of every sibling table), a security-definer author view that survives self-read-only `profiles` RLS, the first Storage bucket + `<input type=file>` upload, and the first runtime slug generator. Delivered as chained PRs on tracker `feat/publicaciones` off `main`.

## Slice boundaries (feature-branch-chain on `feat/publicaciones`)

| Slice | Scope | Branch target | Gate |
|---|---|---|---|
| 1 — DB foundation `[USER-GATED]` | migration `011` (table + 6 indexes + `set_updated_at` fn/trigger + RLS 4 policies + `v_autores_publicos` view) + migration `012` (Storage bucket + 4 `storage.objects` policies) + `gen:types` | `feat/publicaciones` (tracker) | apply via Supabase MCP **after explicit OK**; `lint` + `tsc -b`; **manual RLS check** (anon sees no `borrador`, admin sees all) |
| 2 — Public read path | `dtos.ts` (1 DTO), `publicacionesService` reads, 4 hooks, `BlogPage` + `PublicacionDetallePage` + routes + nav, sections in `TemaPage` + `ClasificacionDetallePage` | PR #1 branch | `lint` + `tsc -b` + manual on `/blog`, `/blog/:slug`, a tema, an SI |
| 3 — Admin write path | `RequireAdmin` guard, `/admin/publicaciones` list/create/edit/delete UI, write service + `src/lib/slug.ts` (collision retry), first file input + Storage upload helper, `video_url` validation | PR #2 branch | `lint` + `tsc -b` + manual create→upload→publish→edit→delete |
| 4 — Seed example content (optional) | `publicaciones` array in `db/seed-content.json` + codegen in `db/seed-to-sql.mjs` `[AUTHOR-WITH-USER]` | PR #3 branch | `node seed-to-sql.mjs` runs; reseed after OK |

Only the tracker branch `feat/publicaciones` merges to `main`. Each child PR targets the previous PR's branch so review diffs stay focused; the tracker accumulates final integration.

## Decision 1 — Single unified table vs three separate tables

**Choice**: ONE table `public.publicaciones`. The blog feed, tema content, and SI content are the same rows under different `WHERE` predicates — `estado='publicado'` for the feed, `+ tema_id = :id` for a tema, `+ clasificacion_si_id = :id` for an SI category.
**Alternatives**: (a) three tables `blog_posts` / `tema_contenidos` / `si_contenidos`, each with its own columns, RLS, service, hooks, pages — triples the surface and guarantees drift; (b) one table + per-surface views — adds DB objects for what is a one-line predicate.
**Rationale**: The three surfaces differ by a FK filter, not by schema. Migration `009` already proved the project favours **one** coherent structure over duplicated tables (it collapsed an inline FK into a clean M2M rather than spawning parallel tables). A single table means one RLS contract, one service, one hook family, one DTO — and the security-sensitive SELECT policy lives in exactly one place instead of three.

## Decision 2 — FK-nullable relationships vs M2M junction tables

**Choice**: `tema_id uuid NULL` and `clasificacion_si_id uuid NULL`, both `ON DELETE SET NULL`. A row may carry both, one, or neither (a pure blog post). No junction tables in v1.
**Alternatives**: (a) M2M junctions `publicacion_temas` / `publicacion_clasificaciones` like `software_clasificaciones` from `009` — supports a publication belonging to many temas/SIs; (b) NOT NULL FKs — would forbid standalone blog posts, breaking surface (a).
**Rationale**: M2M is the right model when the cardinality is genuinely many-to-many AND queried both ways (software ↔ SI category, migration `009`). A publication belongs to **at most one** tema and **at most one** SI category in v1; nullable single FKs express exactly that with zero extra tables, zero extra embeds, and a direct `eq('tema_id', id)` read. `ON DELETE SET NULL` (not `RESTRICT` or `CASCADE`) keeps a publication alive as a plain blog post if its tema/SI is later removed — the editorial content outlives the taxonomy link. If multi-tema demand appears, the junction is an additive migration later; starting with M2M now is speculative complexity.

## Decision 3 — `estado` as Spanish `text` + CHECK vs enum / English values

**Choice**: `estado text NOT NULL default 'borrador' CHECK (estado in ('borrador','publicado'))`. Spanish domain values, `text` + CHECK, **not** a Postgres `enum`.
**Alternatives**: (a) `CREATE TYPE estado_publicacion AS ENUM (...)` — a new type object, harder to extend (enum value adds need `ALTER TYPE`), and inconsistent with the codebase; (b) English values `'draft'/'published'` — violates the Spanish-domain invariant.
**Rationale**: `profiles.role` already establishes the house pattern — a status-like column as `text` + CHECK, not an enum. Spanish values follow invariant XT1 (domain identifiers in Spanish, code identifiers in English): `estado`, `'borrador'`, `'publicado'` are the domain; the TS-side `Publicacion['estado']` literal union is generated from the column. A CHECK constraint is trivially extensible (`ALTER … DROP/ADD CONSTRAINT`) if a future `'archivado'` state appears, with no type-object churn.

## Decision 4 — SELECT RLS must filter drafts (the one deviation from `qual = true`)

**Choice**: the SELECT policy is `USING (estado = 'publicado' OR public.puede_gestionar_contenido())`. INSERT/UPDATE/DELETE policies use `public.puede_gestionar_contenido()` in `WITH CHECK` / `USING`, mirroring migrations `005`/`006`.
**Alternatives**: (a) `qual = true` SELECT (the pattern of `software`, `temas`, `clasificaciones_si`, every other content table) — **leaks every draft to anonymous visitors**; (b) hide drafts only in the service `WHERE estado='publicado'` — security in the client, trivially bypassed by any direct PostgREST call.
**Rationale**: This is the single most security-sensitive line of the feature. Every sibling content table is world-readable because it has no draft state; `publicaciones` does, so copying the `qual = true` sibling pattern is the exact failure mode to prevent. The policy grants read to `anon, authenticated` only when the row is `'publicado'`, OR when the caller is an admin (`puede_gestionar_contenido()` — the gatekeeper from `005`; there is **no** `is_admin()`). RLS, not the service, is authoritative — a draft is invisible to PostgREST itself, so no client path (service, direct REST, malformed request) can surface it. The Slice 1 gate includes a manual check: an anonymous session selecting from `publicaciones` returns zero `borrador` rows; an admin session returns all. Because this is the first anon-scoped policy in the project to reference `public.puede_gestionar_contenido()`, migration `011` MUST include `GRANT EXECUTE ON FUNCTION public.puede_gestionar_contenido() TO anon`; migration `005` granted EXECUTE only to `authenticated`, and Postgres does not guarantee OR short-circuit in an RLS qual, so without this grant an anon session raises a permission-denied error when evaluating the function against a draft row. The function safely returns false for anon (`auth.uid()` is null).

## Decision 5 — Author display via security-definer view (vs denormalize vs public profiles policy)

**Choice**: a security-definer view `public.v_autores_publicos` (`with (security_invoker = false)`) exposing only `id, nombre, apellido` of users who **are** authors, granted to `anon, authenticated`. The read service joins/queries against this view; `profiles` RLS is untouched. Author name = `nombre || ' ' || apellido`, fallback **"Equipo ia-dex"** when both are NULL.
**Alternatives**: (a) denormalize — copy `autor_nombre` onto `publicaciones` at write time — duplicates data, goes stale if the profile changes, and stores PII redundantly; (b) add a public SELECT policy to `profiles` — exposes **every** profile (including non-authors) to `anon`, widening the attack surface far beyond what's needed.
**Rationale**: `profiles` has only nullable `nombre` + `apellido` (no display-name column) and its RLS is self-read-only (`auth.uid() = id`), so an anonymous reader cannot join `publicaciones → profiles` — the author would render blank. A security-definer view runs with the view owner's privileges, bypassing `profiles` RLS, but its `WHERE EXISTS (… publicaciones … autor_id = p.id)` clause exposes **only** people who actually authored something, and **only** three columns. This is the least-privilege answer: `profiles` stays locked down, no PII is duplicated, and nothing about non-authors is reachable. The risk to guard at apply is `security_invoker = true` (the default in newer Postgres) — it must be explicitly `false`, verified by an anonymous read returning a non-blank author name.

## Decision 6 — `updated_at` + maintaining trigger (net-new infra)

**Choice**: `updated_at timestamptz NOT NULL default now()`, maintained by a net-new `public.set_updated_at()` `BEFORE UPDATE` trigger `publicaciones_set_updated_at`.
**Alternatives**: (a) omit `updated_at` — every sibling content table has only `created_at`; (b) `updated_at` with no trigger, set manually in the service — relies on the client remembering on every write path, drifts the moment one path forgets.
**Rationale**: `publicaciones` is the project's first **runtime-edited** content (software/temas/SI are seed-only), so "when was this last changed" is real information, unlike for immutable seed rows. Sibling tables lack `updated_at` precisely because they're never edited at runtime — that absence is not a precedent against it here. The trigger is the correct owner of the value: it fires on every UPDATE regardless of which service path triggered it, so the column can never drift. The function is generic (`new.updated_at := now()`) and intentionally a **global, reusable** trigger function — future tables that need `updated_at` maintenance should attach this same `public.set_updated_at()` function rather than redefining a divergent body under the same name.

## Decision 7 — Public Storage bucket + `getPublicUrl` (vs signed URLs)

**Choice**: a PUBLIC bucket `publicaciones` (public-read), MIME `image/png,image/jpeg,image/webp,image/svg+xml`, 5 MB limit, path `publicaciones/{publicacion_id}/{filename}`. Client flow: `upload(path, file, {upsert:true})` → `getPublicUrl(path)` → store the URL in `imagen_url`, render directly in `<img src>`.
**Alternatives**: (a) private bucket + signed URLs — every render needs a fresh time-limited token, adds a round-trip and expiry handling for content that is **already public** once published; (b) base64 in the column — bloats rows, no CDN.
**Rationale**: Published blog images are public content with no confidentiality requirement — a public bucket + permanent `getPublicUrl` matches how `software.imagen_url` and `clasificaciones_si` images render today (direct `<img src>`, same `text` column type). Signed URLs solve a problem this feature doesn't have. The `storage.objects` policies still gate **writes** to admins (`bucket_id='publicaciones' AND puede_gestionar_contenido()`); only reads are open, scoped to this one bucket. Author-uploaded images bypass the `useImageOk` 200px gate (that gate exists to reject broken/tiny remote thumbnails; author-curated uploads are trusted) and use `object-cover`. Ground-truth gap: creating policies on schema `storage` may require owner perms the MCP role lacks — kept in its own migration `012` so a failure cannot block table migration `011`, with a dashboard fallback recording the SQL for parity.

## Decision 8 — Runtime slug helper + collision retry (net-new)

**Choice**: a new `src/lib/slug.ts`: `titulo` → lowercase → strip accents → non-alphanumeric to `-` → collapse repeated dashes. The `slug` field is **editable** (pre-filled from titulo, override-able). On a UNIQUE violation the write service retries with suffix `-2`, `-3`, … . `slug` is `UNIQUE` at the DB, guarded with `pg_constraint` exactly as migration `007`.
**Alternatives**: (a) require the admin to hand-type every slug (the seed pattern for software/temas/SI) — error-prone and tedious for runtime authoring; (b) a DB-side `BEFORE INSERT` slug trigger — hides URL identity logic in SQL, harder to preview in the form, and still needs collision handling.
**Rationale**: Software/temas/SI slugs are hand-authored **once** in the seed; publicaciones are created at **runtime** by admins typing titles, so a generator is net-new necessity. Keeping slug generation in `src/lib/slug.ts` (not a DB trigger) lets the form show the slug live and lets the admin override it before save — slug is URL identity, the admin should see and control it. The DB UNIQUE constraint is the source of truth for collisions; the service catches the violation and retries with a numeric suffix rather than pre-checking (avoids a TOCTOU race between check and insert). The UNIQUE index is created by the constraint itself — no separate `CREATE UNIQUE INDEX`, guarded by `pg_constraint` like `007`.

## Decision 9 — Admin UI: `RequireAdmin` route guard, RLS as real enforcement

**Choice**: build a `RequireAdmin` route guard wrapping an `/admin/publicaciones` subtree (list/create/edit/delete forms, controlled inputs + `useState`, no forms library). The guard uses `useIsAdmin()` (today dead code) for UI convenience only. **RLS is the authoritative enforcement** — `puede_gestionar_contenido()` blocks every write server-side regardless of client state.
**Alternatives**: (a) trust the client guard alone — `useIsAdmin()` is spoofable (a tampered client can flip it), so without server enforcement a forged admin could write; (b) no UI guard, rely only on RLS — a non-admin reaches the form, fills it, and only fails at save, a poor UX.
**Rationale**: Two layers, each doing its job. The client guard is **convenience** — it keeps non-admins out of the admin UI so they never see a form they can't submit; it is explicitly **not** security, because anything client-side is spoofable. The security boundary is RLS: the write service guards with `auth.getUser()` throwing `'Requiere sesión'` (the `foroService` pattern, lines 52–141) for a friendly early error, but the real wall is `puede_gestionar_contenido()` in the INSERT/UPDATE/DELETE policies — a forged client still hits a server-side denial. `useIsAdmin()` finally gets wired in (it was dead code); the existing action-level `RequireAuthProvider` modal is for authenticated actions, distinct from this route-level admin gate.

## Decision 10 — `cuerpo` plain-text v1 (markdown deferred)

**Choice**: `cuerpo text NULL`, rendered as plain text with `whitespace-pre-wrap`. Drafts may have no body yet (hence nullable).
**Alternatives**: (a) markdown/rich-text now — adds a rendering dependency and an XSS surface (sanitization); (b) a structured block model (JSON blocks) — large scope, premature.
**Rationale**: v1 ships the data model and the full editorial lifecycle; body **formatting** is an independent, additive iteration. Plain text with `whitespace-pre-wrap` preserves the author's line breaks with zero new dependencies and zero XSS surface. Markdown is deferred deliberately (it needs a parser + sanitizer + a content-migration story for existing rows) — adding it later changes only the render layer, not the schema, so nothing here blocks it. Nullable `cuerpo` lets an admin save a titled draft with image/links before writing the body.

## Data flow

```
ADMIN WRITE PATH (Slice 3)
  admin form (controlled inputs)
    │  titulo ──> src/lib/slug.ts ──> slug (editable, prefilled)
    │  file  ──> supabase.storage.from('publicaciones')
    │             .upload('{publicacion_id}/{filename}', file, {upsert:true})
    │             .getPublicUrl() ──> imagen_url
    │  video_url ──> toEmbedUrl() validate (inline error on null)
    ▼
  publicacionesService.crear/editar(...)            auth.getUser() guard → 'Requiere sesión'
    │  INSERT/UPDATE publicaciones  ──[RLS WITH CHECK puede_gestionar_contenido()]──> row
    │  on UNIQUE(slug) violation → retry slug-2, slug-3 …
    ▼
  storage.objects  ──[INSERT/UPDATE/DELETE policy: bucket='publicaciones' AND puede_gestionar_contenido()]

PUBLIC READ PATH (Slice 2)
  BlogPage / PublicacionDetallePage / TemaPage section / ClasificacionDetallePage section
    │            usePublicaciones | usePublicacion(slug) | usePublicacionesPorTema | …PorClasificacion
    ▼
  publicacionesService reads (estado='publicado')
    │  from('publicaciones').select(...)  ──[RLS SELECT: estado='publicado' OR admin]──> only published rows
    │  author  ◀── join v_autores_publicos (security-definer, bypasses profiles RLS)
    │           ──> nombre || ' ' || apellido  ||  'Equipo ia-dex'
    │  enlaces (jsonb) ──> parseEnlaces() ──> Enlace[]  ([] on malformed)
    │  imagen_url ──> <img src> object-cover (bypasses useImageOk gate)
    │  video_url  ──> VideoEmbed + toEmbedUrl
    ▼
  feed  = all published            tema page = + eq('tema_id', id)       SI page = + eq('clasificacion_si_id', id)
                                   (served by idx_publicaciones_estado_created)
```

## Open questions

- [ ] **`chain_strategy` confirmation** — recommended `feature-branch-chain` on tracker `feat/publicaciones` (child PRs target the previous PR's branch; only the tracker merges to main). Needs the user's explicit confirmation before the first PR is opened.
- [ ] **Storage-policy owner perms** — whether the MCP role can `CREATE POLICY` on schema `storage`, or whether bucket/policy creation must go through the Supabase dashboard. Verify at the Slice 1 `012` apply; dashboard fallback records the SQL for parity. Migration `012` is isolated so a failure does not block `011`.
- [ ] **`gen:types` CLI auth** — whether `npm run gen:types` is authenticated against prod ref `othwyesmfpjaykbdwxrh` in this environment, or must be run by the user. Confirm before Slice 2 depends on the regenerated `database.types.ts`.
- [x] **Feed semantics** — RESOLVED (all published). Blog feed = every `estado='publicado'` row `ORDER BY created_at desc`; tema/SI pages add their FK predicate. No model duplication.
- [x] **Author display, `estado` representation, `updated_at`, `cuerpo` rendering, Storage bucket, relationship modeling, blog route** — RESOLVED in the proposal and captured as Decisions 1–10 above.
