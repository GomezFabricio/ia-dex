-- ============================================================================
-- 2026-06-16_018_video_url_si_temas.sql
-- Add a YouTube video_url column to clasificaciones_si and temas.
--
-- Lets admins attach a video (inline edit) on the SI and tema detail pages,
-- which have no video block today. software already has video_url (same text
-- type). Additive, nullable, backward-compatible — no backfill. The detail
-- pages render a VideoEmbed block only when video_url is set.
--
-- ROLLBACK (manual):
--   alter table public.clasificaciones_si drop column if exists video_url;
--   alter table public.temas              drop column if exists video_url;
-- ============================================================================

alter table public.clasificaciones_si add column if not exists video_url text;
alter table public.temas              add column if not exists video_url text;
