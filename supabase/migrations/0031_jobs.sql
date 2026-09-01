create table if not exists app.jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, canonical_company text not null, canonical_title text not null, location text, country text, remote_type text, employment_type text, contract_type text, salary_min numeric, salary_max numeric, salary_currency text, salary_period text, posted_at timestamptz, expires_at timestamptz, discovered_at timestamptz not null default now(), status text not null default 'discovered', normalized_fingerprint text not null, current_description text, created_at timestamptz not null default now()
);
create table if not exists app.job_descriptions (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references app.jobs(id) on delete cascade, version integer not null, original_text_hash text not null, normalized_text text not null, source text not null, fetched_at timestamptz not null default now(), language text, active boolean not null default true, unique (job_id, version)
);
create table if not exists app.job_source_references (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references app.jobs(id) on delete cascade, source_id uuid not null references app.job_sources(id) on delete cascade, external_id text, canonical_url text, source_payload_ref text, source_payload_hash text, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), source_status text not null default 'active', unique (source_id, external_id)
);
