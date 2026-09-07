-- Adzuna authenticates with two values: app_id and app_key. Keep both as
-- environment-variable references; credential values never enter Supabase.
alter table app.job_source_configs
  add column if not exists application_id_ref text;

alter table app.job_source_configs
  drop constraint if exists job_source_configs_application_id_ref_check;

alter table app.job_source_configs
  add constraint job_source_configs_application_id_ref_check
  check (application_id_ref is null or application_id_ref ~ '^[A-Z][A-Z0-9_]{2,79}$');

notify pgrst, 'reload schema';
