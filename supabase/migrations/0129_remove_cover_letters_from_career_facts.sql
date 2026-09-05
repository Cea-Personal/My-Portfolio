-- Cover letters are private writing references, not authoritative career records.
-- Preserve immutable fact versions for audit, but withdraw any canonical fact
-- that was previously approved from a now-classified cover letter.
update app.career_facts fact
set review_status = 'rejected',
    visibility = 'private',
    verified_by_owner = false,
    revision = revision + 1,
    updated_at = now()
from app.fact_reviews review
join app.extracted_facts extracted on extracted.id = review.extracted_fact_id
join app.ingestion_items item on item.id = extracted.ingestion_item_id
join app.documents document on document.id = item.document_id
where review.edited_fact_version_id = fact.current_version_id
  and document.document_kind = 'cover_letter';

-- Retain append-only review history while excluding stale candidates.
-- Evidence chunks and embeddings are deliberately retained for future
-- cover-letter style retrieval.
update app.extracted_facts extracted
set review_status = 'excluded_document_type'
from app.ingestion_items item, app.documents document
where extracted.ingestion_item_id = item.id
  and item.document_id = document.id
  and document.document_kind = 'cover_letter';

notify pgrst, 'reload schema';
