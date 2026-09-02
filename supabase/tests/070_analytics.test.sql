begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, app, published, auth;
select plan(3);
select has_table('app', 'analytics_sessions', 'sessions exist');
select has_table('app', 'analytics_events', 'events exist');
select has_table('app', 'analytics_daily_metrics', 'metrics exist');
select * from finish();
rollback;
