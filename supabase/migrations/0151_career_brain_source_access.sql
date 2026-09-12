-- Career Brain runs in two authorized contexts:
-- 1. the signed-in owner for manual refreshes, protected by table RLS; and
-- 2. the service role for scheduled synthesis, after the workflow has resolved
--    the configured owner explicitly.
--
-- RLS policies do not replace PostgreSQL table privileges. Reassert the
-- smallest read graph required by synthesis so environments where the broad
-- convergence grant did not apply cannot fail at `career_facts` (or at the
-- next joined source table).

grant usage on schema app to authenticated, service_role;

grant select on table
  app.career_facts,
  app.career_fact_versions,
  app.documents,
  app.ingestion_items,
  app.extracted_facts,
  app.evidence_sources,
  app.evidence_versions,
  app.evidence_chunks,
  app.journal_entries,
  app.journal_versions,
  app.applications,
  app.jobs
to authenticated, service_role;

-- Snapshot and retrieval-cache writes were introduced by earlier migrations.
-- Reassert their task-specific privileges here so scheduled and manual runs
-- share the same durable completion path.
grant select, insert on table app.career_brain_snapshots
to authenticated, service_role;

grant select, insert, update, delete on table app.career_brain_retrieval_cache
to authenticated, service_role;

notify pgrst, 'reload schema';
