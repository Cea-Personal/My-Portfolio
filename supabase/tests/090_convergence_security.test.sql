begin;
select plan(18);

select has_table('app', 'career_fact_versions');
select has_table('app', 'evidence_versions');
select has_table('app', 'ingestion_items');
select has_table('app', 'job_search_run_sources');
select has_table('app', 'application_answer_versions');
select has_table('app', 'artifact_versions');
select has_table('app', 'journal_versions');
select has_table('app', 'post_versions');
select has_column('published', 'portfolio_publications', 'owner_id');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'career_facts' and policyname = 'convergence_owner'), 'career facts have an explicit owner policy');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'career_fact_versions' and policyname = 'convergence_parent_owner'), 'fact versions inherit owner policy');
select ok(exists (select 1 from pg_policies where schemaname = 'app' and tablename = 'evidence_chunks' and policyname = 'convergence_parent_owner'), 'evidence chunks inherit owner policy');
select ok(exists (select 1 from pg_trigger where tgname = 'career_fact_versions_append_only'), 'career fact versions are append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'artifact_versions_append_only'), 'artifact versions are append-only');
select ok(has_schema_privilege('authenticated', 'app', 'USAGE'), 'authenticated can reach the protected app schema');
select ok(has_table_privilege('authenticated', 'app.career_facts', 'SELECT'), 'authenticated can read owner-scoped facts');
select ok(not has_table_privilege('anon', 'app.career_facts', 'SELECT'), 'anonymous cannot read private facts');
select ok(has_table_privilege('authenticated', 'published.portfolio_publications', 'INSERT'), 'owners can stage publications');

select * from finish();
rollback;
