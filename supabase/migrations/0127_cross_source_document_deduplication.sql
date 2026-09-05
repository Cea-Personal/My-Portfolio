alter table app.documents
  add column if not exists duplicate_of_id uuid references app.documents(id) on delete restrict;

create index if not exists documents_canonical_owner_created
  on app.documents(owner_id, created_at)
  where duplicate_of_id is null;

-- Existing rows created once by manual upload and again by Drive are retained
-- for audit/source identity, but only the oldest content-identical row remains canonical.
with one_version_documents as (
  select
    d.id as document_id,
    d.owner_id,
    d.created_at,
    dv.internal_sha256
  from app.documents d
  join app.document_versions dv on dv.document_id = d.id
  where d.duplicate_of_id is null
    and (select count(*) from app.document_versions versions where versions.document_id = d.id) = 1
), ranked as (
  select
    document_id,
    first_value(document_id) over (
      partition by owner_id, internal_sha256
      order by created_at, document_id
    ) as canonical_document_id,
    count(*) over (partition by owner_id, internal_sha256) as duplicate_count
  from one_version_documents
)
update app.documents d
set duplicate_of_id = ranked.canonical_document_id,
    availability = 'unavailable'
from ranked
where d.id = ranked.document_id
  and ranked.duplicate_count > 1
  and ranked.document_id <> ranked.canonical_document_id;

update app.evidence_sources source
set availability = 'unavailable'
from app.documents document
where document.duplicate_of_id is not null
  and document.evidence_source_id = source.id;

notify pgrst, 'reload schema';
