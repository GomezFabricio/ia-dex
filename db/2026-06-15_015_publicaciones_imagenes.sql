-- ============================================================================
-- 2026-06-15_015_publicaciones_imagenes.sql
-- Add a multi-image GALLERY to publicaciones.
--
-- Principle: imagen_url stays as the COVER (the single image the feed/cards
-- read for a thumbnail and the detail page shows as the hero). `imagenes` is
-- an ORDERED array of additional public Storage URLs rendered as a gallery on
-- the detail page. Array order = display order (admin-curated).
--
-- Mirrors the existing `enlaces jsonb not null default '[]'` pattern. The
-- gallery is a value object owned by its publication: no per-image query, no
-- per-image RLS, no per-image metadata -> embedded array, not a child table.
--
-- Additive, backward-compatible: existing rows get '[]' from the DEFAULT, so
-- no backfill is needed. No RLS change. No Storage migration (the publicaciones
-- bucket + policies already allow multiple objects per {id}/ prefix).
--
-- ROLLBACK (manual): alter table public.publicaciones drop column if exists imagenes;
-- ============================================================================

alter table public.publicaciones
  add column if not exists imagenes jsonb not null default '[]'::jsonb;

comment on column public.publicaciones.imagenes is
  'Ordered array of additional public Storage image URLs (gallery) shown on the detail page. imagen_url remains the cover. Array order = display order.';
