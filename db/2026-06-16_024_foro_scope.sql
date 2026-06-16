-- ============================================================================
-- 2026-06-16_024_foro_scope.sql
-- Scope a forum debate (temas_foro) to AT MOST ONE catalog dimension:
-- a herramienta (software), a tema, or a "sí" (clasificacion_si). This makes the
-- foro answer the consigna's "debate por aplicación" while still allowing
-- general (unscoped) debates — existing rows keep all three FKs null.
--
-- Model: single-target polymorphic scope via three nullable FKs + a CHECK that
-- enforces "at most one set". Real FKs (not a type/id pair) keep referential
-- integrity. ON DELETE SET NULL: deleting the referenced herramienta/tema/sí
-- demotes its debates back to general instead of deleting the discussion.
--
-- Why "at most one" (not "exactly one"): herramienta→sí is an OPTIONAL m2m and
-- tema↔sí have NO relation, so a validated multi-dimension combo is impossible;
-- a single target per debate cleanly covers the three dimensions with no
-- compatibility conflict. NULL-able keeps existing general debates valid.
--
-- RLS: the temas_foro INSERT policy checks authorship only (auth.uid() =
-- user_id), evaluated per-row — adding nullable columns needs NO policy change
-- (mirrors the verified-remote-state notes in migrations 022/023).
--
-- Idempotent: add column if not exists; constraint + indexes guarded by name.
--
-- ROLLBACK (manual):
--   drop index if exists public.idx_temas_foro_software_id;
--   drop index if exists public.idx_temas_foro_tema_id;
--   drop index if exists public.idx_temas_foro_clasificacion_si_id;
--   alter table public.temas_foro drop constraint if exists temas_foro_scope_at_most_one;
--   alter table public.temas_foro drop column if exists software_id;
--   alter table public.temas_foro drop column if exists tema_id;
--   alter table public.temas_foro drop column if exists clasificacion_si_id;
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- STEP 1: three nullable scope FKs. ON DELETE SET NULL so removing a catalog
-- entity demotes its debates to general (never deletes the discussion).
-- ----------------------------------------------------------------------------
alter table public.temas_foro
  add column if not exists software_id uuid
    references public.software (id) on delete set null,
  add column if not exists tema_id uuid
    references public.temas (id) on delete set null,
  add column if not exists clasificacion_si_id uuid
    references public.clasificaciones_si (id) on delete set null;

-- ----------------------------------------------------------------------------
-- STEP 2: at most one scope dimension may be set. General debates keep all
-- three null (count = 0); a scoped debate sets exactly one (count = 1).
-- Guarded by constraint name so the migration is idempotent.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'temas_foro_scope_at_most_one'
  ) then
    alter table public.temas_foro
      add constraint temas_foro_scope_at_most_one
      check (
        (case when software_id is not null then 1 else 0 end)
        + (case when tema_id is not null then 1 else 0 end)
        + (case when clasificacion_si_id is not null then 1 else 0 end)
        <= 1
      );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- STEP 3: partial indexes for the filtered foro views
-- (/foro?scope_tipo=software&scope_id=… etc.). Partial (WHERE … is not null)
-- because most rows are general and would otherwise bloat the index.
-- ----------------------------------------------------------------------------
create index if not exists idx_temas_foro_software_id
  on public.temas_foro (software_id) where software_id is not null;
create index if not exists idx_temas_foro_tema_id
  on public.temas_foro (tema_id) where tema_id is not null;
create index if not exists idx_temas_foro_clasificacion_si_id
  on public.temas_foro (clasificacion_si_id) where clasificacion_si_id is not null;

commit;
