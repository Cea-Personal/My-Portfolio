-- Journal versions are append-only, so deleting a parent row with cascading
-- child deletes would violate the immutable-history trigger. Treat deletion as
-- an owner-scoped tombstone instead and keep the audit/history intact.
alter table app.journal_entries
  add column if not exists deleted_at timestamptz;

create index if not exists journal_entries_active
  on app.journal_entries(owner_id, entry_date desc)
  where deleted_at is null;

notify pgrst, 'reload schema';
