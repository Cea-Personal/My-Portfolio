-- Archive owner-created profiles instead of deleting their version history or
-- search/application records. Archived profiles are excluded from active UI and
-- selection queries but remain available for audit and historical reconstruction.
alter table app.application_profiles
  add column if not exists archived_at timestamptz;

alter table app.job_search_profiles
  add column if not exists archived_at timestamptz;

create index if not exists application_profiles_owner_active
  on app.application_profiles(owner_id, updated_at desc)
  where archived_at is null;

create index if not exists job_search_profiles_owner_active
  on app.job_search_profiles(owner_id, created_at desc)
  where archived_at is null;
