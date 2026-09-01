create table if not exists app.documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, evidence_source_id uuid references app.evidence_sources(id) on delete set null,
  integration_connection_id uuid references app.integration_connections(id) on delete set null, external_file_id text, name text not null, source_mime text not null, parent_path text, availability text not null default 'available', last_seen_version text, removed_at timestamptz, permission_lost_at timestamptz, created_at timestamptz not null default now(), unique (integration_connection_id, external_file_id)
);
create table if not exists app.document_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references app.documents(id) on delete cascade, evidence_version_id uuid references app.evidence_versions(id) on delete set null,
  provider_version text, export_mime text not null, provider_checksum text, internal_sha256 text not null, modified_at timestamptz, download_status text not null default 'pending', prior_version_id uuid references app.document_versions(id), created_at timestamptz not null default now(), unique (document_id, internal_sha256)
);
create table if not exists app.ingestion_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade, trigger text not null, connection_id uuid references app.integration_connections(id) on delete set null, correlation_id text not null, idempotency_key text not null, status text not null default 'pending' check (status in ('pending','running','completed','partial','failed','cancelled')), started_at timestamptz, finished_at timestamptz, document_count integer not null default 0, error_summary text, workflow_run_id uuid references app.automation_runs(id), created_at timestamptz not null default now(), unique (owner_id, idempotency_key)
);
create table if not exists app.ingestion_items (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references app.ingestion_runs(id) on delete cascade, document_id uuid not null references app.documents(id) on delete cascade, document_version_id uuid references app.document_versions(id) on delete set null, stage text not null default 'queued', status text not null default 'pending', attempts integer not null default 0, parser_metrics jsonb not null default '{}'::jsonb, warnings jsonb not null default '[]'::jsonb, sanitized_error text, started_at timestamptz, finished_at timestamptz, unique (run_id, document_id, document_version_id)
);
create table if not exists app.extracted_facts (
  id uuid primary key default gen_random_uuid(), ingestion_item_id uuid not null references app.ingestion_items(id) on delete cascade, original_extraction jsonb not null, statement text not null, subject_candidate jsonb, confidence numeric(4,3) check (confidence between 0 and 1), trust_level text not null, model_version text, prompt_version text, schema_version text not null, source_offsets jsonb not null, review_status text not null default 'candidate'
);
create table if not exists app.fact_reviews (
  id uuid primary key default gen_random_uuid(), extracted_fact_id uuid not null references app.extracted_facts(id) on delete cascade, reviewer_id uuid not null references app.profiles(id), decision text not null check (decision in ('approve','edit','reject','defer')), edited_fact_version_id uuid references app.career_fact_versions(id), reason text, created_at timestamptz not null default now()
);
