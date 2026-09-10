-- Keep the source-input identity separate from the append-only snapshot run key.
-- A forced re-synthesis must create a new snapshot even when the underlying
-- private inputs have not changed, while cache-first refreshes still need to
-- recognise that snapshot as belonging to the same source state.
alter table app.career_brain_snapshots
  add column if not exists input_source_hash text;

update app.career_brain_snapshots
set input_source_hash = source_hash
where input_source_hash is null;

alter table app.career_brain_snapshots
  alter column input_source_hash set not null;

create index if not exists career_brain_snapshots_input_source
  on app.career_brain_snapshots(owner_id, input_source_hash, generated_at desc);

notify pgrst, 'reload schema';
