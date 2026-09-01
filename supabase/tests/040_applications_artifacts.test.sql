begin;
select plan(5);
select has_table('app', 'applications');
select has_table('app', 'application_forms');
select has_table('app', 'application_answer_versions');
select has_table('app', 'generated_artifacts');
select has_table('app', 'compensation_sources');
select * from finish();
rollback;
