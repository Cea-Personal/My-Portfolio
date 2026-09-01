begin;
select plan(4);
select has_table('app', 'job_sources');
select has_table('app', 'jobs');
select has_table('app', 'job_requirements');
select has_table('app', 'job_scores');
select * from finish();
rollback;
