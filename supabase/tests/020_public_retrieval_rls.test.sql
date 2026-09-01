begin;
select plan(3);
select has_table('app', 'evidence_chunks');
select has_column('app', 'evidence_chunks', 'visibility');
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'app' and tablename = 'evidence_chunks' and indexname = 'evidence_chunks_search_idx'
  ),
  'evidence chunks have the search index'
);
select * from finish();
rollback;
