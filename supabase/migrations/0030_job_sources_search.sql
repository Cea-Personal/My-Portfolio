create table if not exists app.job_sources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, name text not null, adapter_type text not null, adapter_version text not null, provider text, enabled boolean not null default false, terms_note text, capabilities text[] not null default '{}', health_status text not null default 'unknown', created_at timestamptz not null default now()
);
create table if not exists app.job_source_configs (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references app.job_sources(id) on delete cascade, endpoint text, connection_ref text, secret_ref text, field_mapping jsonb not null default '{}', rate_limit_per_minute integer not null default 30, schedule_eligible boolean not null default false, last_test_outcome text, created_at timestamptz not null default now(), unique (source_id)
);
create table if not exists app.job_search_profiles (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, name text not null, target_titles text[] not null default '{}', locations text[] not null default '{}', work_arrangements text[] not null default '{}', employment_types text[] not null default '{}', required_technologies text[] not null default '{}', preferred_technologies text[] not null default '{}', excluded_technologies text[] not null default '{}', scoring_weights jsonb not null default '{}', timezone text not null default 'Africa/Kigali', enabled boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists app.automation_schedules (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, purpose text not null, profile_id uuid references app.job_search_profiles(id) on delete cascade, recurrence text not null, timezone text not null, jitter_seconds integer not null default 0, enabled boolean not null default false, next_run_at timestamptz, last_run_at timestamptz
);
create table if not exists app.job_search_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, profile_id uuid not null references app.job_search_profiles(id) on delete cascade, trigger_type text not null, logical_date date not null, status text not null default 'pending', result_counts jsonb not null default '{}', correlation_id text not null, error_summary text, started_at timestamptz, finished_at timestamptz, unique (profile_id, logical_date, trigger_type)
);
create table if not exists app.job_search_run_sources (
  run_id uuid not null references app.job_search_runs(id) on delete cascade, source_id uuid not null references app.job_sources(id) on delete cascade, status text not null default 'pending', attempts integer not null default 0, fetched_count integer not null default 0, accepted_count integer not null default 0, rejected_count integer not null default 0, rate_limit_metadata jsonb not null default '{}', sanitized_error text, primary key (run_id, source_id)
);
