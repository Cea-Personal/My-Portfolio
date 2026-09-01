create extension if not exists vector;
create table if not exists app.evidence_sources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  source_type text not null, title text not null, canonical_uri text, issuer text, author text,
  visibility text not null default 'private' check (visibility in ('public','private','restricted')), trust_level text not null default 'ai_extracted', verification_state text not null default 'unverified',
  license_notes text, availability text not null default 'available' check (availability in ('available','partial','unavailable')), retention_class text not null default 'standard', created_at timestamptz not null default now()
);
create table if not exists app.evidence_versions (
  id uuid primary key default gen_random_uuid(), evidence_source_id uuid not null references app.evidence_sources(id) on delete cascade, ordinal integer not null,
  external_revision text, raw_object_key text, raw_sha256 text, normalized_text_sha256 text not null, media_type text not null, byte_size bigint not null check (byte_size >= 0), parser_name text, parser_version text, processed_at timestamptz, quarantine_status text not null default 'pending', prior_version_id uuid references app.evidence_versions(id), unique (evidence_source_id, ordinal)
);
create table if not exists app.evidence_chunks (
  id uuid primary key default gen_random_uuid(), evidence_version_id uuid not null references app.evidence_versions(id) on delete cascade, ordinal integer not null check (ordinal >= 0), page_start integer, page_end integer, section_path text[] not null default '{}', char_start integer not null check (char_start >= 0), char_end integer not null check (char_end > char_start), content text not null, content_hash text not null, search_vector tsvector generated always as (to_tsvector('simple', content)) stored, visibility text not null default 'private', trust_level text not null default 'ai_extracted', deleted_at timestamptz, unique (evidence_version_id, ordinal), unique (evidence_version_id, content_hash, char_start, char_end)
);
create table if not exists app.chunk_embeddings (
  id uuid primary key default gen_random_uuid(), chunk_id uuid not null references app.evidence_chunks(id) on delete cascade, provider text not null, model text not null, model_version text not null, dimensions integer not null check (dimensions between 8 and 3072), embedding_version text not null, embedding vector(1536), normalization text, input_hash text not null, status text not null default 'completed', created_at timestamptz not null default now(), unique (chunk_id, embedding_version)
);
create table if not exists app.claim_evidence (
  id uuid primary key default gen_random_uuid(), fact_version_id uuid not null references app.career_fact_versions(id) on delete cascade, evidence_chunk_id uuid not null references app.evidence_chunks(id) on delete cascade, exact_start integer not null check (exact_start >= 0), exact_end integer not null check (exact_end > exact_start), support_class text not null check (support_class in ('direct','transferable','related','weak','contradictory')), verification_status text not null default 'unverified', verifier_actor text, rationale text, created_at timestamptz not null default now(), unique (fact_version_id, evidence_chunk_id, exact_start, exact_end)
);
create index if not exists evidence_chunks_search_idx on app.evidence_chunks using gin(search_vector);
