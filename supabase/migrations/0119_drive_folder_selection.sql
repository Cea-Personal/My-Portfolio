-- Owner-selected Drive corpus. A connection may be authorized before a folder is chosen.
alter table app.integration_connections
  add column if not exists selected_folder_id text,
  add column if not exists selected_folder_name text;

create index if not exists integration_connections_drive_folder
  on app.integration_connections(owner_id, provider, selected_folder_id)
  where provider = 'drive' and status = 'active';
