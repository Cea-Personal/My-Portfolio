-- Make the application workspace explicit about its selected profile and source.
-- A profile is optional while an application is being prepared, but once selected
-- the foreign key prevents dangling deterministic answers after deletion.
alter table app.applications
  add column if not exists application_profile_id uuid references app.application_profiles(id) on delete set null;

create index if not exists applications_application_profile
  on app.applications(application_profile_id);

-- Manual/authorized job imports retain their origin without requiring a source
-- adapter. LinkedIn links are stored as owner-supplied references; they are not
-- fetched or scraped by the application.
alter table app.jobs
  add column if not exists source_url text,
  add column if not exists source_provider text not null default 'manual';

create index if not exists jobs_source_provider on app.jobs(owner_id, source_provider);
