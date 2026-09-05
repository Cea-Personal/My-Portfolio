grant select on app.ai_provider_configs, app.ai_capability_configs to service_role;
grant select, insert, update on app.ai_provider_health, app.ai_runs to service_role;

create index if not exists chunk_embeddings_cosine_hnsw
  on app.chunk_embeddings using hnsw (embedding vector_cosine_ops)
  where status = 'completed' and embedding is not null;

create or replace function app.match_private_evidence(
  requested_embedding vector(1536),
  requested_provider text,
  requested_model text,
  requested_model_version text,
  requested_kinds text[] default null,
  requested_limit integer default 12,
  requested_min_similarity real default 0.20
)
returns table(
  chunk_id uuid,
  evidence_source_id uuid,
  document_id uuid,
  document_kind text,
  source_title text,
  content text,
  page_start integer,
  page_end integer,
  section_path text[],
  similarity real
)
language sql
stable
security invoker
set search_path = pg_catalog, app, public
as $$
  select
    chunk.id,
    source.id,
    document.id,
    coalesce(document.document_kind, 'other'),
    source.title,
    chunk.content,
    chunk.page_start,
    chunk.page_end,
    chunk.section_path,
    (1 - (embedding.embedding <=> requested_embedding))::real
  from app.chunk_embeddings embedding
  join app.evidence_chunks chunk on chunk.id = embedding.chunk_id
  join app.evidence_versions version on version.id = chunk.evidence_version_id
  join app.evidence_sources source on source.id = version.evidence_source_id
  left join app.document_versions document_version on document_version.evidence_version_id = version.id
  left join app.documents document on document.id = document_version.document_id
  where source.owner_id = auth.uid()
    and app.is_configured_owner()
    and source.availability = 'available'
    and chunk.deleted_at is null
    and embedding.status = 'completed'
    and embedding.provider = requested_provider
    and embedding.model = requested_model
    and embedding.model_version = requested_model_version
    and (requested_kinds is null or coalesce(document.document_kind, 'other') = any(requested_kinds))
    and 1 - (embedding.embedding <=> requested_embedding) >= requested_min_similarity
  order by embedding.embedding <=> requested_embedding, chunk.id
  limit least(greatest(requested_limit, 1), 50);
$$;

revoke all on function app.match_private_evidence(vector,text,text,text,text[],integer,real)
  from public, anon;
grant execute on function app.match_private_evidence(vector,text,text,text,text[],integer,real)
  to authenticated;

notify pgrst, 'reload schema';
