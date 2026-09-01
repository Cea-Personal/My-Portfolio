begin;
select plan(4);
select has_table('app', 'posts');
select has_table('app', 'post_versions');
select has_table('app', 'post_publication_approvals');
select has_column('app', 'post_versions', 'evidence_ids');
select * from finish();
rollback;
