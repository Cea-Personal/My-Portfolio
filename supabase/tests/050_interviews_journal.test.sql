begin;
select plan(4);
select has_table('app', 'interview_processes');
select has_table('app', 'interview_stages');
select has_table('app', 'journal_entries');
select has_table('app', 'mock_interviews');
select * from finish();
rollback;
