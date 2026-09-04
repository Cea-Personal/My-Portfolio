-- The durable search worker uses a service-role JWT. RLS bypass does not grant
-- PostgreSQL privileges, so expose only the tables required by job discovery.
grant usage on schema app to service_role;

grant select
on app.job_search_profiles,
   app.job_source_configs
to service_role;

grant select, update
on app.job_sources,
   app.job_search_runs
to service_role;

grant select, insert, update
on app.job_search_run_sources,
   app.raw_jobs,
   app.jobs,
   app.job_source_references,
   app.job_descriptions,
   app.job_scores
to service_role;

grant select, insert
on app.job_status_history
to service_role;

notify pgrst, 'reload schema';
