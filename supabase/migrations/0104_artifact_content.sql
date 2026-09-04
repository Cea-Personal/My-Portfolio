alter table app.artifact_versions
  add column if not exists structured_content jsonb not null default '{}',
  add column if not exists provenance jsonb not null default '{}';

alter table app.artifact_versions drop constraint if exists artifact_versions_status_check;
alter table app.artifact_versions add constraint artifact_versions_status_check
  check (status in ('draft', 'owner_reviewed', 'final', 'rejected', 'submitted_snapshot', 'superseded'));

create index if not exists artifact_versions_status_created
  on app.artifact_versions(artifact_id, status, created_at desc);
