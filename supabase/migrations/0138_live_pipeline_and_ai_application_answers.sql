-- Live discovery persistence and generated application-answer metadata.
-- Live discovery is owner-scoped, append-only at the event level, and keeps
-- review candidates separate from the opportunity pipeline.

drop index if exists app.job_search_runs_scheduled_dedupe_idx;
create unique index if not exists job_search_runs_scheduled_dedupe_idx
  on app.job_search_runs (profile_id, logical_date, trigger_type)
  where trigger_type not in ('manual', 'live_web');

alter table app.jobs
  add column if not exists discovery_profile_id uuid references app.job_search_profiles(id) on delete set null,
  add column if not exists discovery_search_run_id uuid references app.job_search_runs(id) on delete set null,
  add column if not exists discovery_source text,
  add column if not exists discovery_eligibility text,
  add column if not exists discovery_reasons jsonb not null default '[]'::jsonb,
  add column if not exists discovery_match_result jsonb not null default '{}'::jsonb;

create index if not exists jobs_discovery_profile
  on app.jobs(owner_id, discovery_profile_id, discovered_at desc);
create index if not exists jobs_discovery_run
  on app.jobs(owner_id, discovery_search_run_id, discovered_at desc);

create table if not exists app.job_discovery_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  profile_id uuid not null references app.job_search_profiles(id) on delete cascade,
  search_run_id uuid not null references app.job_search_runs(id) on delete cascade,
  job_id uuid references app.jobs(id) on delete set null,
  source_provider text not null,
  source_name text,
  external_job_id text,
  canonical_url text,
  fingerprint text not null,
  title text not null,
  company text not null,
  location text,
  description text,
  outcome text not null check (outcome in ('PASS', 'FAIL', 'REVIEW')),
  reasons jsonb not null default '[]'::jsonb,
  match_result jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  unique (owner_id, profile_id, search_run_id, fingerprint)
);

create index if not exists job_discovery_events_owner_queue
  on app.job_discovery_events(owner_id, outcome, discovered_at desc);
create index if not exists job_discovery_events_profile
  on app.job_discovery_events(owner_id, profile_id, discovered_at desc);

alter table app.job_discovery_events enable row level security;
grant select, insert on app.job_discovery_events to authenticated;
revoke all on app.job_discovery_events from anon;
drop policy if exists job_discovery_events_owner on app.job_discovery_events;
create policy job_discovery_events_owner on app.job_discovery_events
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from app.job_search_profiles p
      where p.id = profile_id and p.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from app.job_search_runs r
      where r.id = search_run_id and r.owner_id = (select auth.uid())
    )
  );

create trigger job_discovery_events_append_only
  before update or delete on app.job_discovery_events
  for each row execute function app.prevent_append_only_mutation();

alter table app.application_answer_versions
  add column if not exists generated_at timestamptz,
  add column if not exists generation_status text not null default 'manual'
    check (generation_status in ('manual', 'generated', 'needs_owner_input', 'approved')),
  add column if not exists generation_error text;

create index if not exists application_answers_generation
  on app.application_answer_versions(field_id, generation_status, created_at desc);

notify pgrst, 'reload schema';
