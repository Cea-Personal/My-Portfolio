alter table app.documents
  add column if not exists document_kind text not null default 'other'
    check (document_kind in ('resume', 'cover_letter', 'other')),
  add column if not exists classification_confidence numeric(4,3)
    check (classification_confidence is null or classification_confidence between 0 and 1),
  add column if not exists classification_reason text;

update app.documents
set document_kind = 'cover_letter',
    classification_confidence = 0.900,
    classification_reason = 'cover-letter filename signal'
where name ~* '(^|[^a-z])(cover([ _-]?letter)?|motivation[ _-]?letter)([^a-z]|$)';

update app.documents
set document_kind = 'resume',
    classification_confidence = 0.880,
    classification_reason = 'CV/resume filename signal'
where document_kind = 'other'
  and name ~* '(^|[^a-z])(cv|resume|curriculum[ _-]?vitae)([^a-z]|$)';

create index if not exists documents_owner_kind_available
  on app.documents(owner_id, document_kind, created_at desc)
  where duplicate_of_id is null and availability = 'available';

notify pgrst, 'reload schema';
