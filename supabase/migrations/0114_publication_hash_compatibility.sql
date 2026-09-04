-- 0100's security-definer body resolves digest() through the app search path.
-- Keep the wrapper private while delegating explicitly to pgcrypto in the
-- Supabase-managed extensions schema.
create or replace function app.digest(payload text, algorithm text)
returns bytea
language sql
immutable
strict
security definer
set search_path = pg_catalog, extensions
as $$
  select extensions.digest(payload, algorithm);
$$;

revoke all on function app.digest(text, text) from public, anon, authenticated;
