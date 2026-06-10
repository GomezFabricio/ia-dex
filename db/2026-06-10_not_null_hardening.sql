-- Schema hardening applied on 2026-06-10 via Supabase Management API.
-- Context: PRD section 6 defined created_at/orden without NOT NULL, while the
-- DTO contracts in PRD section 10 require them non-null. Per the PRD SSOT rule
-- (section 1), the schema was corrected so both agree.
-- Tables were empty at the time; no backfill was needed.

alter table public.temas              alter column created_at set default now(), alter column created_at set not null;
alter table public.clasificaciones_si alter column created_at set default now(), alter column created_at set not null;
alter table public.software           alter column created_at set default now(), alter column created_at set not null;
alter table public.valoraciones      alter column created_at set default now(), alter column created_at set not null;
alter table public.temas_foro         alter column created_at set default now(), alter column created_at set not null;
alter table public.mensajes_foro      alter column created_at set default now(), alter column created_at set not null;
alter table public.eventos            alter column created_at set default now(), alter column created_at set not null;

alter table public.temas              alter column orden set default 0, alter column orden set not null;
alter table public.clasificaciones_si alter column orden set default 0, alter column orden set not null;

alter table public.clasificaciones_si alter column enlaces set default '[]'::jsonb, alter column enlaces set not null;
alter table public.eventos            alter column metadata set default '{}'::jsonb, alter column metadata set not null;
