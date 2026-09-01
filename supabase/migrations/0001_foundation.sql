create schema if not exists app;
create schema if not exists published;
create schema if not exists api;

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
begin
  new.updated_at = clock_timestamp();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create table if not exists app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  headline text check (headline is null or char_length(headline) <= 240),
  bio text check (bio is null or char_length(bio) <= 10000),
  location text check (location is null or char_length(location) <= 240),
  timezone text not null default 'Africa/Kigali',
  locale text not null default 'en',
  links jsonb not null default '{}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.integration_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  connection_type text not null,
  external_account_id text not null,
  status text not null default 'pending' check (status in ('pending','active','error','revoked')),
  scopes text[] not null default '{}',
  secret_ref text not null check (secret_ref ~ '^secret:/[a-z0-9][a-z0-9._/-]{2,255}$'),
  cursor text,
  cursor_version text,
  channel_id text,
  channel_expires_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, external_account_id)
);

create table if not exists app.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  actor_type text not null check (actor_type in ('owner','workflow','provider','system')),
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 120),
  target_type text not null,
  target_id uuid,
  correlation_id text not null,
  before_metadata jsonb not null default '{}'::jsonb,
  after_metadata jsonb not null default '{}'::jsonb,
  reason text,
  ip_pseudonym text,
  user_agent_class text,
  occurred_at timestamptz not null default now()
);

create table if not exists app.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_name text not null check (event_name ~ '\\.v[0-9]+$'),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'pending' check (status in ('pending','published','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  unique (event_name, idempotency_key)
);

create table if not exists app.idempotency_keys (
  owner_id uuid not null references app.profiles(id) on delete cascade,
  key text not null check (key ~ '^[A-Za-z0-9._:-]{8,256}$'),
  request_hash text not null,
  status text not null check (status in ('in_progress','completed','failed')),
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

create table if not exists app.automation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  workflow_name text not null,
  workflow_version integer not null default 1,
  status text not null default 'pending' check (status in ('pending','running','completed','partial','failed','cancelled')),
  correlation_id text not null,
  idempotency_key text not null,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_detail text check (error_detail is null or char_length(error_detail) <= 1000),
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create table if not exists app.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references app.automation_runs(id) on delete cascade,
  step_name text not null,
  step_version integer not null default 1,
  operation_key text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','partial','failed','cancelled')),
  input_refs jsonb not null default '[]'::jsonb,
  output_refs jsonb not null default '[]'::jsonb,
  attempt_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  unique (run_id, operation_key)
);

create table if not exists published.portfolio_publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  version bigint not null,
  status text not null check (status in ('staged','published','withdrawn')),
  content_hash text not null,
  schema_version text not null default 'portfolio.v1',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  withdrawn_at timestamptz,
  unique (owner_id, version)
);

create unique index if not exists one_active_publication_per_owner
on published.portfolio_publications(owner_id) where status = 'published';

create table if not exists published.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references published.portfolio_publications(id) on delete cascade,
  public_id text not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  section text not null,
  career_stage text,
  display_order integer not null default 0,
  title text not null,
  subtitle text,
  public_summary text not null,
  display_metric text,
  display_technologies text[] not null default '{}',
  sanitized_media jsonb not null default '[]'::jsonb,
  public_citations jsonb not null default '[]'::jsonb,
  detail_slug text,
  payload_schema_version text not null default 'portfolio-item.v1',
  unique (publication_id, public_id)
);

create table if not exists published.public_evidence (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references published.portfolio_publications(id) on delete cascade,
  public_evidence_id text not null,
  safe_title text not null,
  issuer text,
  occurred_on date,
  sanitized_excerpt text,
  source_location_label text,
  evidence_type text not null,
  source_version_hash text not null,
  unique (publication_id, public_evidence_id)
);

create or replace view api.current_publication with (security_invoker = true) as
select id, owner_id, version, content_hash, schema_version, published_at
from published.portfolio_publications
where status = 'published';

create or replace view api.public_portfolio_items with (security_invoker = true) as
select i.* from published.portfolio_items i
join published.portfolio_publications p on p.id = i.publication_id and p.status = 'published';

create trigger profiles_updated_at before update on app.profiles
for each row execute function app.set_updated_at();
create trigger connections_updated_at before update on app.integration_connections
for each row execute function app.set_updated_at();
create trigger idempotency_updated_at before update on app.idempotency_keys
for each row execute function app.set_updated_at();
