-- Owner document bytes are stored in a non-public bucket. Object names are
-- derived server-side as `<owner-id>/documents/<document-id>/v<version>`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-documents',
  'private-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists private_documents_owner_read on storage.objects;
create policy private_documents_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-documents'
    and app.is_configured_owner()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists private_documents_owner_insert on storage.objects;
create policy private_documents_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-documents'
    and app.is_configured_owner()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists private_documents_owner_delete on storage.objects;
create policy private_documents_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private-documents'
    and app.is_configured_owner()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
