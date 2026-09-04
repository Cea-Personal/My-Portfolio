-- A document version's content identity is immutable, but indexing must be able
-- to attach processing metadata after the binary is uploaded. The generic
-- append-only trigger introduced in 0090 blocked that legitimate transition.
create or replace function app.protect_document_version_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'document_versions is append-only' using errcode = '55006';
  end if;

  if new.id is distinct from old.id
     or new.document_id is distinct from old.document_id
     or new.provider_version is distinct from old.provider_version
     or new.export_mime is distinct from old.export_mime
     or new.provider_checksum is distinct from old.provider_checksum
     or new.internal_sha256 is distinct from old.internal_sha256
     or new.modified_at is distinct from old.modified_at
     or new.prior_version_id is distinct from old.prior_version_id
     or new.created_at is distinct from old.created_at then
    raise exception 'document version identity is immutable' using errcode = '55006';
  end if;

  -- Processing is monotonic: an attached object/evidence version cannot be
  -- silently replaced with a different one or cleared.
  if old.storage_object_path is not null
     and new.storage_object_path is distinct from old.storage_object_path then
    raise exception 'document storage object is immutable' using errcode = '55006';
  end if;
  if old.evidence_version_id is not null
     and new.evidence_version_id is distinct from old.evidence_version_id then
    raise exception 'indexed evidence version is immutable' using errcode = '55006';
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_append_only on app.document_versions;
drop trigger if exists document_versions_identity_guard on app.document_versions;
create trigger document_versions_identity_guard
before update or delete on app.document_versions
for each row execute function app.protect_document_version_identity();

-- Repair metadata created by the earlier metadata-only upload implementation.
-- The object key format is deterministic and remains owner scoped.
update app.document_versions version
set storage_object_path = coalesce(
  document.parent_path,
  document.owner_id::text || '/documents/' || document.id::text || '/v1'
)
from app.documents document
where document.id = version.document_id
  and version.storage_object_path is null;

notify pgrst, 'reload schema';
