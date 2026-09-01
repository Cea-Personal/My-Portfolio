create table if not exists app.ai_provider_configs (
  id uuid primary key default gen_random_uuid(), provider text not null, model text not null, model_version text not null, capabilities text[] not null default '{}', secret_ref text, enabled boolean not null default true, created_at timestamptz not null default now(), unique (provider, model, model_version)
);
create table if not exists app.prompt_versions (
  id uuid primary key default gen_random_uuid(), prompt_name text not null, version integer not null, content_hash text not null, template text not null, schema_version text not null, created_at timestamptz not null default now(), unique (prompt_name, version)
);
create table if not exists app.ai_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid references app.profiles(id) on delete cascade, task text not null, provider_config_id uuid references app.ai_provider_configs(id), prompt_version_id uuid references app.prompt_versions(id), status text not null default 'pending', input_hash text, output_hash text, error_code text, created_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists app.retrieval_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid references app.profiles(id) on delete cascade, query_hash text not null, visibility_scope text not null, retrieval_version text not null, created_at timestamptz not null default now()
);
create table if not exists app.retrieval_candidates (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references app.retrieval_runs(id) on delete cascade, evidence_chunk_id uuid references app.evidence_chunks(id), rank integer not null, lexical_score numeric, vector_score numeric, rerank_score numeric
);
create table if not exists app.ai_claims (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references app.ai_runs(id) on delete cascade, statement text not null, visibility text not null, verified boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists app.ai_citations (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references app.ai_claims(id) on delete cascade, evidence_chunk_id uuid references app.evidence_chunks(id), source_version_hash text not null, exact_start integer, exact_end integer, opaque_handle_hash text not null
);
create table if not exists app.ai_evaluations (
  id uuid primary key default gen_random_uuid(), suite text not null, case_id text not null, result text not null, score numeric, details jsonb not null default '{}', created_at timestamptz not null default now()
);
