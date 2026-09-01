insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('private-source', 'private-source', false, 52428800, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown']),
  ('private-artifact', 'private-artifact', false, 52428800, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
  ('public-media', 'public-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy private_source_owner on storage.objects for all to authenticated
using (bucket_id = 'private-source' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'private-source' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy private_artifact_owner on storage.objects for all to authenticated
using (bucket_id = 'private-artifact' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'private-artifact' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy public_media_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy public_media_owner_update on storage.objects for update to authenticated
using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy public_media_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
