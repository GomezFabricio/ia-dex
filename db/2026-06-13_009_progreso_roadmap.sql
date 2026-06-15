-- 2026-06-13_009_progreso_roadmap.sql
-- PR-7 / T25 — Per-user roadmap progress.
--
-- New table (additive). RLS is enabled from creation with all four policies
-- enumerated — crucially INCLUDING UPDATE: completing a stage upserts on the
-- (user_id, tema_id) PK, and without an UPDATE policy RLS rejects the upsert
-- silently. The WITH CHECK on insert/update blocks writing rows for another user.
-- Both FKs cascade on delete so a removed user or tema leaves no orphan rows.
--
-- Idempotent: table guarded by IF NOT EXISTS; each policy dropped-then-created.
-- ROLLBACK (manual): drop table public.progreso_roadmap;

create table if not exists public.progreso_roadmap (
  user_id uuid not null references auth.users on delete cascade,
  tema_id uuid not null references public.temas on delete cascade,
  completado_at timestamptz not null default now(),
  primary key (user_id, tema_id)
);

alter table public.progreso_roadmap enable row level security;

drop policy if exists "select_own_progress" on public.progreso_roadmap;
create policy "select_own_progress" on public.progreso_roadmap
  for select using (auth.uid() = user_id);

drop policy if exists "insert_own_progress" on public.progreso_roadmap;
create policy "insert_own_progress" on public.progreso_roadmap
  for insert with check (auth.uid() = user_id);

drop policy if exists "update_own_progress" on public.progreso_roadmap;
create policy "update_own_progress" on public.progreso_roadmap
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete_own_progress" on public.progreso_roadmap;
create policy "delete_own_progress" on public.progreso_roadmap
  for delete using (auth.uid() = user_id);
