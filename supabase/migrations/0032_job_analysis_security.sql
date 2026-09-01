create table if not exists app.job_requirements (
  id uuid primary key default gen_random_uuid(), description_id uuid not null references app.job_descriptions(id) on delete cascade, normalized_text text not null, category text not null, priority text not null, skills text[] not null default '{}', sequence integer not null, extraction_version text not null, confidence numeric(4,3) check (confidence between 0 and 1)
);
create table if not exists app.job_requirement_matches (
  id uuid primary key default gen_random_uuid(), requirement_id uuid not null references app.job_requirements(id) on delete cascade, run_id uuid references app.ai_runs(id) on delete set null, match_class text not null, evidence_value numeric(4,3) check (evidence_value between 0 and 1), explanation text, claim_evidence_ids uuid[] not null default '{}'
);
create table if not exists app.job_scores (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references app.jobs(id) on delete cascade, description_id uuid references app.job_descriptions(id) on delete set null, score_type text not null, numeric_score numeric(8,4) not null, factor_values jsonb not null, weights jsonb not null, calculation_version text not null, evidence_snapshot jsonb not null, created_at timestamptz not null default now()
);
create table if not exists app.job_status_history (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references app.jobs(id) on delete cascade, from_status text, to_status text not null, actor_id uuid, reason text, note text, transitioned_at timestamptz not null default now()
);
alter table app.jobs enable row level security;
create policy jobs_owner on app.jobs for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create index if not exists jobs_owner_status on app.jobs(owner_id, status);
