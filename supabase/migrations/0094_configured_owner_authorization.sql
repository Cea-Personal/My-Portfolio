-- A Supabase session identifies a user but does not grant Career OS owner
-- authority.  This table is intentionally provisioned by a deployment or
-- recovery operator, not by a browser/API route.

create table if not exists app.owner_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  check ((active and revoked_at is null) or ((not active) and revoked_at is not null))
);

-- The product has exactly one active owner. To configure it after applying
-- this migration, an operator must insert the auth user ID and matching
-- `app.profiles` row using a privileged, audited deployment/recovery path.
create unique index if not exists owner_authorizations_one_active_owner
  on app.owner_authorizations ((active))
  where active;

alter table app.owner_authorizations enable row level security;
revoke all on app.owner_authorizations from anon, authenticated;
grant select on app.owner_authorizations to authenticated;

drop policy if exists owner_authorizations_self_read on app.owner_authorizations;
create policy owner_authorizations_self_read on app.owner_authorizations
  for select to authenticated
  using (user_id = (select auth.uid()) and active);

-- This is security definer so it can act as the common restrictive predicate
-- without requiring every client to have broader access to the allow-list.
create or replace function app.is_configured_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app
as $$
  select exists (
    select 1
    from app.owner_authorizations
    where user_id = (select auth.uid())
      and active
  );
$$;

revoke all on function app.is_configured_owner() from public;
grant execute on function app.is_configured_owner() to authenticated;

-- Existing owner-id policies stay responsible for row ownership. This
-- restrictive policy adds the separate configured-owner boundary to every
-- private table, including future tables present when this migration runs.
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'app'
      and tablename <> 'owner_authorizations'
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'app'
        and tablename = table_name
        and policyname = 'configured_owner_only'
    ) then
      execute format(
        'create policy configured_owner_only on app.%I as restrictive for all to authenticated using (app.is_configured_owner()) with check (app.is_configured_owner())',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Published rows remain public for anonymous reads, but authenticated writes
-- now require both the configured-owner predicate and existing ownership
-- policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['portfolio_publications', 'portfolio_items', 'public_evidence'] loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'published'
        and tablename = table_name
        and policyname = 'configured_owner_only'
    ) then
      execute format(
        'create policy configured_owner_only on published.%I as restrictive for all to authenticated using (app.is_configured_owner()) with check (app.is_configured_owner())',
        table_name
      );
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
