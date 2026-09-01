begin;
select plan(3);
select has_table('app', 'analytics_sessions');
select has_table('app', 'analytics_events');
select has_table('app', 'analytics_daily_metrics');
select * from finish();
rollback;
