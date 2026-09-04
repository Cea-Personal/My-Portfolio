-- Multi-source discovery amendment: make source scheduling, health, extraction,
-- deterministic filtering, and broader profile criteria first-class data.

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

alter table app.job_source_configs drop constraint if exists job_source_configs_frequency_check;
alter table app.job_source_configs add constraint job_source_configs_frequency_check
  check (discovery_frequency_minutes between 15 and 43200);

alter table app.job_search_profiles
  add column if not exists preferred_titles text[] not null default '{}',
  add column if not exists excluded_titles text[] not null default '{}',
  add column if not exists seniority_levels text[] not null default '{}',
  add column if not exists regions text[] not null default '{}',
  add column if not exists remote_restrictions text[] not null default '{}',
  add column if not exists nice_to_have_technologies text[] not null default '{}',
  add column if not exists industries text[] not null default '{}',
  add column if not exists company_sizes text[] not null default '{}',
  add column if not exists preferred_companies text[] not null default '{}',
  add column if not exists excluded_companies text[] not null default '{}',
  add column if not exists visa_sponsorship text,
  add column if not exists relocation_support text,
  add column if not exists language_requirements text[] not null default '{}',
  add column if not exists minimum_salary numeric,
  add column if not exists preferred_salary numeric,
  add column if not exists salary_currency text,
  add column if not exists max_job_age_days integer not null default 30;

alter table app.job_search_profiles drop constraint if exists job_search_profiles_salary_check;
alter table app.job_search_profiles add constraint job_search_profiles_salary_check
  check (
    (minimum_salary is null or minimum_salary >= 0)
    and (preferred_salary is null or preferred_salary >= 0)
    and max_job_age_days between 1 and 365
  );

alter table app.job_search_run_sources
  add column if not exists pages_fetched integer not null default 0,
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists review_count integer not null default 0,
  add column if not exists duration_ms integer,
  add column if not exists http_status integer,
  add column if not exists completed_at timestamptz;

create table if not exists app.raw_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  source_id uuid not null references app.job_sources(id) on delete cascade,
  external_job_id text,
  source_url text,
  content_hash text not null,
  payload jsonb not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'normalized', 'rejected', 'failed')),
  filter_outcome text check (filter_outcome in ('PASS', 'FAIL', 'REVIEW')),
  filter_reasons jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (owner_id, source_id, content_hash)
);

create index if not exists raw_jobs_owner_fetched
  on app.raw_jobs(owner_id, fetched_at desc);
create index if not exists raw_jobs_source_status
  on app.raw_jobs(source_id, processing_status, fetched_at desc);

alter table app.raw_jobs enable row level security;
grant select, insert, update, delete on app.raw_jobs to authenticated;
revoke all on app.raw_jobs from anon;
drop policy if exists raw_jobs_owner on app.raw_jobs;
create policy raw_jobs_owner on app.raw_jobs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
