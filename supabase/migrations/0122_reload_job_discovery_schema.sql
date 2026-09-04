-- Reassert amendment columns idempotently and force PostgREST to refresh its
-- schema cache after the linked Cloud migration.
alter table app.job_sources
  add column if not exists last_run_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists last_discovered_count integer not null default 0,
  add column if not exists last_accepted_count integer not null default 0;

alter table app.job_source_configs
  add column if not exists discovery_frequency_minutes integer not null default 1440,
  add column if not exists extraction_config jsonb not null default '{}';

notify pgrst, 'reload schema';
