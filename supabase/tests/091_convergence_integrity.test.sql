begin;
select plan(21);

select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'retrieval_candidates' and policyname = 'convergence_parent_owner'), 'retrieval candidates inherit run ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'retrieval_candidates' and policyname = 'convergence_owner_consistency'), 'retrieval candidates enforce restrictive ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'ai_claims' and policyname = 'convergence_parent_owner'), 'AI claims inherit run ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'ai_citations' and policyname = 'convergence_owner_consistency'), 'AI citations enforce claim and evidence ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'application_package_items' and policyname = 'convergence_owner_consistency'), 'package items enforce artifact ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'job_search_run_sources' and policyname = 'convergence_owner_consistency'), 'search source rows enforce run/source ownership');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'fact_reviews' and policyname = 'convergence_owner_consistency'), 'fact reviews require owner reviewer');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'application_documents' and policyname = 'convergence_owner_consistency'), 'application documents enforce application ownership');
select ok(exists (select 1 from pg_trigger where tgname = 'evidence_chunks_visibility_guard'), 'chunk visibility guard exists');
select ok(exists (select 1 from pg_proc where pronamespace = 'app'::regnamespace and proname = 'enforce_evidence_chunk_visibility'), 'chunk visibility function exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'app.evidence_chunks'::regclass and conname = 'evidence_chunks_visibility_check'), 'chunk visibility values are constrained');
select ok(exists (select 1 from pg_trigger where tgname = 'job_descriptions_append_only'), 'job descriptions are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'job_scores_append_only'), 'job scores are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'compensation_sources_append_only'), 'compensation sources are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'compensation_recommendations_append_only'), 'compensation recommendations are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'application_package_items_append_only'), 'package membership is append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'artifact_reviews_append_only'), 'artifact reviews are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'artifact_submitted_snapshots_append_only'), 'submitted snapshots are append-only');
select ok(has_table_privilege('authenticated', 'app.retrieval_candidates', 'SELECT'), 'authenticated can read owner-scoped retrieval candidates');
select ok(not has_table_privilege('anon', 'app.retrieval_candidates', 'SELECT'), 'anonymous cannot read retrieval candidates');
select ok(has_table_privilege('authenticated', 'app.artifact_reviews', 'INSERT'), 'authenticated can record artifact reviews');

select * from finish();
rollback;
