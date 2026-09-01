begin;
select plan(5);
select has_table('app', 'career_facts');
select has_table('app', 'career_fact_versions');
select has_table('app', 'evidence_chunks');
select has_table('app', 'claim_evidence');
select has_table('published', 'portfolio_items');
select * from finish();
rollback;
