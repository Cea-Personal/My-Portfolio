alter table app.job_scores
  add column if not exists search_run_id uuid references app.job_search_runs(id) on delete set null;

drop index if exists app.job_scores_job_type_version;

create unique index if not exists job_scores_manual_version_unique
  on app.job_scores(job_id, score_type, calculation_version)
  where search_run_id is null;

create unique index if not exists job_scores_search_run_version_unique
  on app.job_scores(job_id, score_type, calculation_version, search_run_id)
  where search_run_id is not null;

create index if not exists job_scores_search_run_lookup
  on app.job_scores(search_run_id, created_at desc)
  where search_run_id is not null;
