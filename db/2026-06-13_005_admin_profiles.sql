-- ============================================================================
-- 2026-06-13_005_admin_profiles.sql
-- Applied to PRODUCTION via Supabase MCP (migration: admin_profiles_roles).
--
-- Admin role foundation: profiles + capability function + signup trigger.
-- Verified via MCP before applying: RLS is ALREADY enabled on all public tables
-- by an event trigger (public.rls_auto_enable), so `profiles` gets RLS
-- auto-enabled too. We add an explicit self-read policy; NO public write policy
-- => `role` is never client-writable. auth.users had 2 rows (backfilled below).
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  nombre text,
  apellido text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Authenticated users read ONLY their own profile (drives role / useIsAdmin).
create policy "leer perfil propio" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Capability function = single source of truth for "can manage content".
-- security definer + pinned search_path (hardening). exists() => missing row is false.
create function public.puede_gestionar_contenido()
  returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.puede_gestionar_contenido() from public;
grant execute on function public.puede_gestionar_contenido() to authenticated;

-- Signup trigger: create the profile row, pulling nombre/apellido from signup
-- metadata (email: nombre/apellido) or Google OAuth (given_name/family_name,
-- with full_name fallback). security definer + pinned search_path + EXCEPTION
-- so a failure NEVER aborts signup.
create function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nombre text := nullif(trim(coalesce(m->>'nombre', m->>'given_name')), '');
  v_apellido text := nullif(trim(coalesce(m->>'apellido', m->>'family_name')), '');
  v_full text;
begin
  if v_nombre is null or v_apellido is null then
    v_full := nullif(trim(coalesce(m->>'full_name', m->>'name')), '');
    if v_full is not null then
      if v_nombre is null then v_nombre := split_part(v_full, ' ', 1); end if;
      if v_apellido is null then
        v_apellido := nullif(trim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)), '');
      end if;
    end if;
  end if;

  insert into public.profiles (id, nombre, apellido)
  values (new.id, v_nombre, v_apellido)
  on conflict (id) do nothing;
  return new;
exception when others then
  raise log 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users (idempotent).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
