-- OAuth state and credential material are never readable by ordinary product
-- clients. The callback uses a service role after validating a short-lived,
-- PKCE-bound state record; tokens are AES-GCM encrypted before persistence.
create table if not exists app.drive_oauth_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  state_hash text not null unique,
  verifier_ciphertext text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists app.integration_oauth_credentials (
  connection_id uuid primary key references app.integration_connections(id) on delete cascade,
  ciphertext text not null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table app.drive_oauth_states enable row level security;
alter table app.integration_oauth_credentials enable row level security;
revoke all on app.drive_oauth_states, app.integration_oauth_credentials from anon, authenticated;
grant insert on app.drive_oauth_states to authenticated;

create policy drive_oauth_states_owner_insert on app.drive_oauth_states
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and app.is_configured_owner());

create index if not exists drive_oauth_states_expiry on app.drive_oauth_states(expires_at) where used_at is null;

create or replace function app.revoke_integration_oauth_credentials()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
begin
  if new.status = 'revoked' and old.status is distinct from new.status then
    delete from app.integration_oauth_credentials where connection_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists integration_connection_revokes_oauth_credentials on app.integration_connections;
create trigger integration_connection_revokes_oauth_credentials
after update of status on app.integration_connections
for each row execute function app.revoke_integration_oauth_credentials();
