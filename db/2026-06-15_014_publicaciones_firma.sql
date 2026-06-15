-- ============================================================================
-- 2026-06-15_014_publicaciones_firma.sql
-- Add an OPTIONAL byline override to publicaciones.
--
-- Principle: identity (who created it) is NOT the displayed byline. autor_id
-- stays as the true creator (audit / "my posts"); `firma` is an optional
-- presentation override. Display precedence (in the read service):
--   firma (if non-empty)  →  autor profile name (nombre+apellido)  →  "Equipo ia-dex"
--
-- Nullable, additive, no backfill needed (NULL = use the computed name).
--
-- ROLLBACK (manual): alter table public.publicaciones drop column if exists firma;
-- ============================================================================

alter table public.publicaciones add column if not exists firma text;

comment on column public.publicaciones.firma is
  'Optional byline override shown instead of the author profile name / "Equipo ia-dex" fallback. autor_id remains the true creator.';
