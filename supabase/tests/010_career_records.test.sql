begin;
select plan(4);
select has_table('app', 'career_experiences');
select has_table('app', 'projects');
select has_table('app', 'skills');
select policies_are('app', 'career_experiences', array['career_experiences_owner']);
select * from finish();
rollback;
