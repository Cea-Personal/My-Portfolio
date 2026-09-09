-- Public Ask Basil retrieval uses the same production embeddings as private
-- retrieval, but exposes only chunks that are present in the active published
-- evidence projection. No private source, chunk, or vector is returned.

create or replace function app.match_public_evidence(
  requested_embedding vector(1536),
  requested_provider text,
  requested_model text,
  requested_model_version text,
  requested_limit integer default 8,
  requested_min_similarity real default 0.20
)
returns table(
  public_evidence_id text,
  safe_title text,
  sanitized_excerpt text,
  source_version_hash text,
  similarity real
)
language sql
stable
security definer
set search_path = pg_catalog, app, published, public
as $$
  select
    evidence.public_evidence_id,
    evidence.safe_title,
    evidence.sanitized_excerpt,
    evidence.source_version_hash,
    (1 - (embedding.embedding <=> requested_embedding))::real
  from published.public_evidence evidence
  join published.portfolio_publications publication
    on publication.id = evidence.publication_id
   and publication.status = 'published'
  join app.evidence_chunks chunk
    on evidence.public_evidence_id = 'evidence-' || chunk.id::text
  join app.chunk_embeddings embedding
    on embedding.chunk_id = chunk.id
  where chunk.visibility = 'public'
    and chunk.deleted_at is null
    and embedding.status = 'completed'
    and embedding.embedding is not null
    -- Public AI is limited to career evidence and technical writing. Journals,
    -- analytics, applications, interviews, compensation, and audit material
    -- are never eligible even if a row was accidentally made public.
    and lower(coalesce(evidence.evidence_type, '')) not in (
      'journal', 'journal_entry', 'personal_note', 'analytics', 'analytics_event',
      'audit', 'audit_event', 'application', 'interview', 'compensation', 'compensation_research'
    )
    and embedding.provider = requested_provider
    and embedding.model = requested_model
    and embedding.model_version = requested_model_version
    and 1 - (embedding.embedding <=> requested_embedding) >= requested_min_similarity
  order by embedding.embedding <=> requested_embedding, chunk.id
  limit least(greatest(requested_limit, 1), 20);
$$;

revoke all on function app.match_public_evidence(vector,text,text,text,integer,real)
  from public;
grant execute on function app.match_public_evidence(vector,text,text,text,integer,real)
  to anon, authenticated;

notify pgrst, 'reload schema';
