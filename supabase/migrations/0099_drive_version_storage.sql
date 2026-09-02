-- Every immutable document version must retain the exact private object that
-- produced it. Uploaded documents created before this migration continue to
-- resolve through documents.parent_path while new ingestion writes this field.
alter table app.document_versions
  add column if not exists storage_object_path text;

alter table app.document_versions
  add constraint document_versions_storage_object_path_safe
  check (
    storage_object_path is null
    or (
      char_length(storage_object_path) between 3 and 1024
      and storage_object_path !~ '(^|/)\.\.(/|$)'
      and storage_object_path !~ '^/'
    )
  ) not valid;

alter table app.document_versions
  validate constraint document_versions_storage_object_path_safe;

create index if not exists document_versions_storage_object_path_idx
  on app.document_versions(storage_object_path)
  where storage_object_path is not null;
