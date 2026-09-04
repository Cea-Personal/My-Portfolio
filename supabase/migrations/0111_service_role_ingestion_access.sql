-- Server-side document ingestion uses Supabase's service-role JWT. RLS bypass
-- does not imply schema/table privileges, so grant only the objects required by
-- the document -> evidence -> chunk -> embedding pipeline.
grant usage on schema app to service_role;

grant select, insert, update
on app.documents,
   app.document_versions,
   app.ingestion_runs,
   app.ingestion_items,
   app.evidence_sources,
   app.evidence_versions,
   app.evidence_chunks,
   app.chunk_embeddings,
   app.extracted_facts
to service_role;

notify pgrst, 'reload schema';
