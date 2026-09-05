-- Manual searches are user actions and may legitimately be repeated on the same day.
-- Keep the daily idempotency guard for scheduled/non-manual runs only.
alter table app.job_search_runs
  drop constraint if exists job_search_runs_profile_id_logical_date_trigger_type_key;

create unique index if not exists job_search_runs_scheduled_dedupe_idx
  on app.job_search_runs (profile_id, logical_date, trigger_type)
  where trigger_type <> 'manual';
