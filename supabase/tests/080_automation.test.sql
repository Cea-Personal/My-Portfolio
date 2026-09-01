begin;
select plan(4);
select has_table('app', 'automation_runs');
select has_table('app', 'automation_run_steps');
select has_table('app', 'outbox_events');
select has_table('app', 'idempotency_keys');
select * from finish();
rollback;
