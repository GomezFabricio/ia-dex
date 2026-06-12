-- Review fixes migration
-- Fixes applied:
--   1. Remove dead NEW.embedding := null from AFTER trigger
--   2. Add embed_shared_secret to Vault + RPC get_embed_secret()
--   3. Add supabase_anon_key to Vault; trigger reads both from Vault only — no hardcoded fallbacks
--   4. NOTE: nombre is NOT NULL per schema hardening (not_null_hardening migration),
--      so the generated fts column expression is safe without COALESCE on nombre.
--      No column DDL change needed.
-- Applied: 2026-06-12

-- ============================================================
-- 1. Vault: store anon key (seeded from the value in the original migration)
-- ============================================================
-- Upsert pattern: create if absent, update if present.
do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'supabase_anon_key') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'supabase_anon_key' limit 1),
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aHd5ZXNtZnBqYXlrYmR3eHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzg5ODgsImV4cCI6MjA5NjY1NDk4OH0.nE0sFVgNPBP2TMestyRCsbXaVcJaG8ZBeEdC8FqZRXU'
    );
  else
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90aHd5ZXNtZnBqYXlrYmR3eHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzg5ODgsImV4cCI6MjA5NjY1NDk4OH0.nE0sFVgNPBP2TMestyRCsbXaVcJaG8ZBeEdC8FqZRXU',
      'supabase_anon_key',
      'Supabase anon/public JWT for embed trigger http call'
    );
  end if;
end;
$$;

-- ============================================================
-- 2. Vault: create embed shared secret
-- ============================================================
do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'embed_shared_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'embed_shared_secret' limit 1),
      gen_random_uuid()::text || gen_random_uuid()::text
    );
  else
    perform vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'embed_shared_secret',
      'Shared secret for embed edge function caller authentication'
    );
  end if;
end;
$$;

-- ============================================================
-- 3. RPC: get_embed_secret — callable only by service_role
-- ============================================================
create or replace function public.get_embed_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
    from vault.decrypted_secrets
   where name = 'embed_shared_secret'
   limit 1;
$$;

revoke execute on function public.get_embed_secret() from public;
revoke execute on function public.get_embed_secret() from anon;
revoke execute on function public.get_embed_secret() from authenticated;
grant  execute on function public.get_embed_secret() to service_role;

-- ============================================================
-- 4. Recreated trigger function
--    Key changes vs original:
--    - Removed: NEW.embedding := null  (AFTER triggers cannot modify NEW — silently ignored)
--      Async race window: stale embedding persists in the row until the embed edge function
--      writes back. This is acceptable — the window is typically <2 s under normal load.
--    - Removed: hardcoded URL fallback and hardcoded anon key
--    - Both project URL and anon key are read from Vault only.
--      If either is null: raise warning, return NEW without firing pg_net — fail loudly in logs.
--    - Reads embed_shared_secret from Vault and sends it as x-embed-secret header.
-- ============================================================
create or replace function public.trigger_embed_on_software_change()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_project_url   text;
  v_anon_key      text;
  v_embed_secret  text;
begin
  -- Fetch all required secrets from Vault
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets
   where name = 'supabase_project_url'
   limit 1;

  select decrypted_secret into v_anon_key
    from vault.decrypted_secrets
   where name = 'supabase_anon_key'
   limit 1;

  select decrypted_secret into v_embed_secret
    from vault.decrypted_secrets
   where name = 'embed_shared_secret'
   limit 1;

  -- Fail loudly if any secret is missing — never proceed with nulls or hardcoded values
  if v_project_url is null then
    raise warning 'trigger_embed: Vault secret supabase_project_url is null — skipping embed call';
    return NEW;
  end if;

  if v_anon_key is null then
    raise warning 'trigger_embed: Vault secret supabase_anon_key is null — skipping embed call';
    return NEW;
  end if;

  if v_embed_secret is null then
    raise warning 'trigger_embed: Vault secret embed_shared_secret is null — skipping embed call';
    return NEW;
  end if;

  -- Fire async HTTP POST to embed edge function
  -- Note: AFTER trigger — NEW cannot be mutated here. The embed function writes the
  -- embedding back via service role. Stale embedding persists in the row during the
  -- async window (typically <2 s). This is acceptable by design.
  perform net.http_post(
    url     := v_project_url || '/functions/v1/embed',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'x-embed-secret', v_embed_secret
    ),
    body    := jsonb_build_object('id', NEW.id)
  );

  return NEW;
end;
$$;
