# Publicaciones — One Unified Content Table for Blog, Temas, and SI

Introduce a single table `public.publicaciones` that serves **three** content surfaces at once: (a) standalone blog posts at `/blog`, (b) per-tema didactic content, and (c) per-SI content. The three surfaces are not three tables — they are the **same** table read through different **FK filters** (`tema_id`, `clasificacion_si_id`, or neither). This adds the project's first admin-authored runtime content, its first `<input type=file>` + Storage upload, and its first role-gated CRUD UI, delivered end-to-end (DB → types → services → hooks → UI) as chained PRs on a tracker branch `feat/publicaciones` off `main`.

## Why

The catalog today exposes only **seed-authored** content: software, temas, and SI classifications loaded from `db/seed-content.json` and never edited at runtime. There is no way for an admin to publish a piece of writing — no blog, no "contenido didáctico" hung off a tema, no extra explanatory content hung off an SI category. The teaching site has structure (temas, axes, categories) but no **editorial layer** on top of it.

The naive answer would be three tables (`blog_posts`, `tema_contenidos`, `si_contenidos`), each with its own columns, RLS, service, hooks, and pages — three times the surface for one conceptual thing: *a publication that optionally belongs to a tema or an SI category*. That triples the maintenance cost and guarantees drift. The correct model is **one** table whose rows optionally carry a `tema_id` and/or a `clasificacion_si_id`; the "blog feed" is simply every published row, a tema page is the rows filtered by `tema_id`, an SI page is the rows filtered by `clasificacion_si_id`. The difference between the three surfaces is a **WHERE clause**, not a schema.

This also surfaces, for the first time, infrastructure the app has never needed: a **draft/published lifecycle** (`estado`), a **public-read-only-when-published** RLS rule (every other content table is world-readable with `qual = true`; this one is not), an **author display** path that survives the self-read-only `profiles` RLS, **image upload** to Storage, and a **runtime slug** generator with collision retry (slugs are hand-authored in the seed today; admins will type titles at runtime).

## What changes

### Scope IN (by layer)

**DB**
- NEW table `public.publicaciones` (migration `db/2026-06-15_011_publicaciones.sql`): `id`, `slug` (UNIQUE), `titulo`, `cuerpo` (nullable — drafts may have no body yet), `imagen_url`, `video_url`, `enlaces` (`jsonb default '[]'` — precedent `clasificaciones_si.enlaces`), `tema_id` FK → `temas` `ON DELETE SET NULL`, `clasificacion_si_id` FK → `clasificaciones_si` `ON DELETE SET NULL`, `autor_id` FK → `profiles` `ON DELETE SET NULL` `default auth.uid()` (precedent `software.created_by`), `estado text NOT NULL default 'borrador' CHECK (estado in ('borrador','publicado'))` (text + CHECK, not enum — precedent `profiles.role`), `created_at`, `updated_at`.
- NEW indexes: `idx_publicaciones_estado`, partial `idx_publicaciones_tema_id` (where not null), partial `idx_publicaciones_clasificacion_si` (where not null), `idx_publicaciones_autor_id`, and the blog-feed coverage index `idx_publicaciones_estado_created on (estado, created_at desc)`. The `slug` UNIQUE constraint already creates its own index — no separate unique index is added (guard with `pg_constraint`, mirroring migration 007).
- NEW infra: function `public.set_updated_at()` + trigger `publicaciones_set_updated_at before update`. `updated_at` is net-new in this codebase, so the maintaining trigger is built here.
- RLS on `publicaciones` mirroring `puede_gestionar_contenido()` (there is **no** `is_admin()`), with **one critical deviation**: the SELECT policy is `USING (estado = 'publicado' OR public.puede_gestionar_contenido())` — **not** the `qual = true` of every other content table. Drafts must never leak to the public.
- NEW security-definer view `public.v_autores_publicos` (`security_invoker = false`) exposing only `id, nombre, apellido` of users who **are** authors, granted to `anon, authenticated`. `profiles` RLS is self-read-only, so the `publicaciones → profiles` join fails for anonymous readers; the read service queries this view instead. `profiles` RLS is untouched.
- NEW Storage (migration `db/2026-06-15_012_storage_publicaciones.sql`): a PUBLIC bucket `publicaciones` (MIME `image/png,image/jpeg,image/webp,image/svg+xml`, 5 MB limit) and `storage.objects` policies reusing `puede_gestionar_contenido()` (public SELECT for the bucket; admin-only INSERT/UPDATE/DELETE). Path convention `publicaciones/{publicacion_id}/{filename}`.

**Seed (optional, Slice 4)**
- Optionally add a `publicaciones` array to `db/seed-content.json` and a codegen section in `db/seed-to-sql.mjs` for example content. Not required for the feature to function.

**Types / Services / Hooks**
- Regenerate `database.types.ts` via `npm run gen:types` after the DB migrations (generated file — never hand-edited).
- New DTO in `dtos.ts`: `export type Publicacion = Omit<Tables<'publicaciones'>,'enlaces'> & { enlaces: Enlace[] }` (identical narrowing to `ClasificacionSI`; `Enlace` already exists). `TablesInsert/TablesUpdate<'publicaciones'>` for the write service.
- New service `src/services/publicacionesService.ts` (flat async functions, no classes). Reads: `listarPublicaciones()` (feed, `estado='publicado'`), `obtenerPublicacion(slug)` with `.maybeSingle()`, `listarPorTema(temaId)`, `listarPorClasificacion(clasifId)`; `enlaces` parsed at the read boundary copying `clasificacionesService.parseEnlaces` (returns `[]` on malformed); author name joined from `v_autores_publicos`. Writes (admin): `crear/editar/eliminar/subirImagen` guarded by `auth.getUser()` throwing `'Requiere sesión'` (pattern from `foroService`); RLS does the real enforcement.
- New hooks: `usePublicaciones`, `usePublicacion` (single, `'pending'` action + slug in deps to reset stale state), `usePublicacionesPorTema(temaId)`, `usePublicacionesPorClasificacion(clasifId)` — `useReducer` state machine returning `{data, loading, error, refetch}`, mirroring `useTemas` / `useTema`.
- New runtime slug helper `src/lib/slug.ts`: `titulo` → lowercase, strip accents, non-alphanumeric → `-`, collapse dashes. Slug is an editable field (pre-filled from titulo, override-able); on UNIQUE collision the write service retries with `-2`, `-3`.

**UI**
- New pages + routes: `BlogPage.tsx` (feed) and `PublicacionDetallePage.tsx`, both with the D4 state quartet (loading / error+retry / not-found / data). Routes `{ path:'blog' }` and `{ path:'blog/:slug' }` under `AppLayout` in `AppRouter.tsx`. Nav: `{to:'/blog',label:'Blog'}` in `navLinks.ts` + a `/blog` glyph in `navIcons.tsx`.
- Modify `TemaPage.tsx`: add a "Contenido didáctico" `<section>` after the hero, fed by `usePublicacionesPorTema(tema.data?.id)` (mirrors `useSoftwarePorTema`).
- Modify `ClasificacionDetallePage.tsx`: add an analogous section after the ejemplos/enlaces column, fed by `usePublicacionesPorClasificacion(data?.id)`.
- Media reuse: `video_url` via `VideoEmbed` + `toEmbedUrl` as-is; the admin form validates `video_url` with `toEmbedUrl` and shows an error (VideoEmbed silently returns null on a bad URL). Author-uploaded images render directly in `<img src>` with `object-cover`, **bypassing** the `useImageOk` 200px gate (author-curated).
- Admin UI (FULL, net-new): a `RequireAdmin` route guard, an `/admin/publicaciones` subtree, list + create + edit + delete forms (controlled inputs + `useState` — no forms library), and the app's first `<input type=file>` + Storage upload helper. `useIsAdmin()` exists but is currently dead code; it gates the UI only (spoofable client-side) — RLS is the real server-side enforcement.

### Scope OUT (explicitly)

- **Markdown / rich-text body** — `cuerpo` renders as plain text (`whitespace-pre-wrap`) in v1. Markdown is a later iteration (new dependency + XSS surface).
- **Ratings for publicaciones** — would require extending the `valoraciones.contenido_tipo` CHECK to `'publicacion'`, the `ContenidoTipo` union, and a cleanup trigger. Not in v1.
- **M2M tema/SI** — `tema_id` and `clasificacion_si_id` are nullable single FKs. No junction tables in v1.
- **Admin CRUD for software / temas / SI** — this change builds CRUD UI for `publicaciones` **only**. The role backend (`puede_gestionar_contenido`, `useIsAdmin`) is reused, not rebuilt, and the other content types remain seed-authored.

## Approach

### One table, three reads (the whole point)

```
public.publicaciones
  id, slug (unique), titulo, cuerpo, imagen_url, video_url, enlaces (jsonb)
  tema_id            ──FK→ temas              (nullable, ON DELETE SET NULL)
  clasificacion_si_id ──FK→ clasificaciones_si (nullable, ON DELETE SET NULL)
  autor_id           ──FK→ profiles           (nullable, default auth.uid())
  estado ('borrador' | 'publicado')           created_at / updated_at

  Blog feed  = WHERE estado='publicado'                       ORDER BY created_at desc
  Tema page  = WHERE estado='publicado' AND tema_id = :id     ORDER BY created_at desc
  SI page    = WHERE estado='publicado' AND clasificacion_si_id = :id
```

No model duplication: the feed semantics are **all published**, and the tema/SI surfaces simply add one FK predicate. A row may carry both FKs, one, or neither (a pure blog post).

### The single most security-sensitive line

Every other content table (`software`, `temas`, `clasificaciones_si`, …) has a SELECT policy with `qual = true` — world-readable. `publicaciones` **must not**. Its SELECT policy is:

```
USING (estado = 'publicado' OR public.puede_gestionar_contenido())
```

If that `OR estado = 'publicado'` gate is forgotten and copied from the `qual = true` pattern, **every draft leaks to anonymous visitors**. This deviation is called out in the spec (RLS), the design, and the migration tasks so it cannot be lost.

### Author display without weakening profiles RLS

`profiles` has no display-name column — only nullable `nombre` + `apellido` — and its RLS is self-read-only (`auth.uid() = id`). An anonymous reader therefore cannot join `publicaciones → profiles`; the author would render blank. Rather than relax `profiles` RLS, we add a **security-definer view** `v_autores_publicos` that exposes only `id, nombre, apellido` of users who actually authored a publication, granted to `anon, authenticated`. The read service joins against the view; the author name is `nombre || ' ' || apellido` with the fallback **"Equipo ia-dex"** when both are null. `profiles` itself stays locked down.

### First Storage, first file input, first CRUD UI

This feature introduces three things the codebase has never had: (1) a Storage bucket and its `storage.objects` policies, authored as SQL in `db/` (the bucket is **public-read**, admin-write); (2) a client upload flow — `supabase.storage.from('publicaciones').upload(path, file, {upsert:true})` then `getPublicUrl(path)` → stored in `imagen_url` and rendered directly in `<img src>`; (3) a real admin CRUD area behind a `RequireAdmin` route guard, since today the only auth surface is the action-level `RequireAuthProvider` modal. `useIsAdmin()` already exists but is dead code — it will gate the UI for convenience, with RLS as the authoritative server-side check.

### Runtime slugs with collision retry

Software, temas, and SI slugs are hand-authored in the seed; publicaciones are created at **runtime**, so we add `src/lib/slug.ts` (lowercase → strip accents → non-alphanumeric to `-` → collapse dashes). The slug field is editable (pre-filled from the title), and on a UNIQUE violation the write service retries with `-2`, `-3`. Any seed example content follows the migration-007 guard pattern (backfill → DO block aborts on null/dup → UNIQUE guarded by `pg_constraint` → SET NOT NULL).

## Impact

| Layer | Touched | Nature |
|---|---|---|
| DB tables | `publicaciones` (new) | structural |
| DB infra | `set_updated_at()` fn + `publicaciones_set_updated_at` trigger (new) | net-new infra |
| DB views | `v_autores_publicos` (new, security-definer) | additive |
| DB policies | RLS on `publicaciones` (with the published-only SELECT deviation) | additive (custom SELECT) |
| Storage | bucket `publicaciones` (public) + `storage.objects` policies | greenfield (first bucket) |
| Seed | `db/seed-content.json` + `db/seed-to-sql.mjs` (optional, Slice 4) | additive, `[AUTHOR-WITH-USER]` |
| Types | `database.types.ts` (regenerated), `dtos.ts` (1 new DTO) | generated + additive |
| Services | `publicacionesService.ts` (new), `src/lib/slug.ts` (new) | net-new |
| Hooks | `usePublicaciones`, `usePublicacion`, `usePublicacionesPorTema`, `usePublicacionesPorClasificacion` (new) | additive |
| UI pages | `BlogPage`, `PublicacionDetallePage`, `/admin/publicaciones` subtree, `RequireAdmin` (new) | net-new |
| UI integration | `TemaPage`, `ClasificacionDetallePage` (sections); `AppRouter`, `navLinks`, `navIcons` | additive |

Reused without modification: `puede_gestionar_contenido()`, `useIsAdmin()` (currently dead — now wired in), `VideoEmbed` + `lib/youtube.ts:toEmbedUrl`, `RequireAuthProvider`, the `useReducer` hook pattern, the `parseEnlaces` enlaces-parsing pattern. `profiles` RLS is **not** changed — the view sidesteps it.

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| SELECT policy copied as `qual = true` from sibling tables → **drafts leak to the public** | HIGH | Policy is fixed at `USING (estado = 'publicado' OR public.puede_gestionar_contenido())`, called out in spec RLS, design, and the migration task. Manual RLS check in the Slice 1 gate: anon cannot see `borrador`, admin can. |
| Creating policies on schema `storage` may require **owner perms** the MCP role lacks | MEDIUM | Flagged as a migration risk to verify at apply. If the policy DDL fails, fall back to creating the bucket/policies via the Supabase dashboard and record the SQL for parity. Kept in its own migration `012` so a failure does not block table migration `011`. |
| `v_autores_publicos` accidentally created with `security_invoker = true` → anon join fails again, authors render blank | MEDIUM | View is explicitly `with (security_invoker = false)` and granted to `anon, authenticated`; verified by an anonymous read returning a non-blank author. |
| Runtime slug collision on concurrent/duplicate titles | MEDIUM | `src/lib/slug.ts` + write-service retry with `-2`, `-3` on UNIQUE violation; `slug` stays editable so the admin can override. |
| `useIsAdmin()` is spoofable client-side → a tampered client reaches admin UI | LOW | UI gate is convenience only; **RLS is authoritative** — `puede_gestionar_contenido()` blocks writes server-side regardless of client state. |
| Bad `video_url` renders nothing (VideoEmbed silently returns null) | LOW | Admin form validates `video_url` with `toEmbedUrl` and shows an inline error before save. |
| `anon` lacks EXECUTE on `puede_gestionar_contenido()`; RLS2 references it for draft rows | MEDIUM | `GRANT EXECUTE ON FUNCTION public.puede_gestionar_contenido() TO anon` in migration `011` (fn returns false for anon since `auth.uid()` is null); verified by the anon-feed-with-drafts RLS check (no function-permission error). |
| Production migration applied without user consent | PROCESS | Every production DB migration runs **only** after explicit user OK; the orchestrator applies via the Supabase MCP once approved. Slice 1 is `[USER-GATED]`. |

## Delivery

Tracker branch `feat/publicaciones` off `main` (`plan-mejoras` already merged to main), **chained PRs** (locked `delivery_strategy = chained`), recommended `chain_strategy = feature-branch-chain` — only the tracker branch merges to main; child PRs target the previous PR's branch. Natural slice boundaries (each its own reviewable PR):

1. **DB foundation** `[USER-GATED]` — migration `011` (table + indexes + `updated_at` fn/trigger + RLS + `v_autores_publicos`) + migration `012` (Storage bucket + `storage.objects` policies) + `gen:types`. *Each production migration runs only after explicit user OK.* Verification: `lint` + `tsc -b` + **manual RLS check** (anon cannot see borradores; admin can).
2. **Public read path** — DTO, `publicacionesService` reads, hooks, `BlogPage` + `PublicacionDetallePage` + routes + nav, integrate the sections into `TemaPage` + `ClasificacionDetallePage`. Read-only, public.
3. **Admin write path** — `RequireAdmin` guard, `/admin/publicaciones` UI (list/create/edit/delete), write service + `src/lib/slug.ts` (runtime slug + collision retry), the first `<input type=file>` + Storage upload helper, `video_url` validation.
4. **Optional seed/example content** — `publicaciones` array in `db/seed-content.json` + codegen in `db/seed-to-sql.mjs`. `[AUTHOR-WITH-USER]`.

Verification per slice (no test runner — `strict_tdd: false`): `npm run lint` + `tsc -b` (build) + manual / Playwright visual checks on the affected pages. Code, identifiers, comments, UI copy, and commits in **English**; the domain model (table/column/slug names) and user-facing copy stay **Spanish** (invariant XT1).

## Open decisions

The six design questions raised during exploration are **resolved** below; only the three ground-truth gaps remain genuinely open.

- **Author display — RESOLVED (option C, security-definer view).** Author name comes from `v_autores_publicos` (`security_invoker = false`), joined at the read boundary, `nombre || ' ' || apellido` with fallback **"Equipo ia-dex"**. `profiles` RLS is untouched.
- **Feed semantics — RESOLVED (all published).** The blog feed is every row with `estado='publicado'` ordered by `created_at desc`; tema/SI pages add their FK predicate. No model duplication.
- **`estado` representation — RESOLVED (Spanish text + CHECK).** `estado text NOT NULL default 'borrador' CHECK (estado in ('borrador','publicado'))` — Spanish values, `text` + CHECK not an enum (precedent `profiles.role`).
- **`updated_at` — RESOLVED (yes, add it).** `updated_at timestamptz NOT NULL default now()` maintained by the net-new `set_updated_at()` trigger.
- **`cuerpo` rendering — RESOLVED (plain text v1).** Rendered `whitespace-pre-wrap`. Markdown/rich-text is out of scope.
- **Storage bucket — RESOLVED (public bucket).** Bucket `publicaciones` is public-read, admin-write; images render directly via `getPublicUrl`.
- **Relationship modeling — RESOLVED (FK-nullable, not M2M).** `tema_id` and `clasificacion_si_id` are nullable single FKs `ON DELETE SET NULL`. No junction tables in v1.
- **Blog route — RESOLVED (`/blog`).** Routes `/blog` (feed) and `/blog/:slug` (detail), nav entry "Blog".

Still open (ground-truth gaps to confirm at apply time):

- **`chain_strategy` confirmation.** Recommended `feature-branch-chain` on tracker `feat/publicaciones`; needs the user's explicit confirmation before the first PR is opened.
- **Storage-policy owner perms.** Whether the MCP role can create policies on schema `storage`, or whether bucket/policy creation must go through the Supabase dashboard — verify at the Slice 1 apply.
- **`gen:types` CLI auth.** Whether `npm run gen:types` is authenticated against the prod ref `othwyesmfpjaykbdwxrh` in this environment, or must be run by the user — confirm before Slice 2 depends on the regenerated `database.types.ts`.
