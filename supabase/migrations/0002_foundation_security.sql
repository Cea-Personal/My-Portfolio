alter table app.profiles enable row level security;
alter table app.integration_connections enable row level security;
alter table app.audit_events enable row level security;
alter table app.outbox_events enable row level security;
alter table app.idempotency_keys enable row level security;
alter table app.automation_runs enable row level security;
alter table app.automation_run_steps enable row level security;
alter table published.portfolio_publications enable row level security;
alter table published.portfolio_items enable row level security;
alter table published.public_evidence enable row level security;

revoke all on schema app from public, anon, authenticated;
revoke all on schema published from public, anon, authenticated;
revoke all on schema api from public;
grant usage on schema api to anon, authenticated;
grant usage on schema published to anon, authenticated;

grant select, insert, update on app.profiles to authenticated;
grant select, insert, update on app.integration_connections to authenticated;
grant select on app.audit_events to authenticated;
grant select, insert, update on app.idempotency_keys to authenticated;
grant select, insert, update on app.automation_runs, app.automation_run_steps to authenticated;
grant select on api.current_publication, api.public_portfolio_items to anon, authenticated;
grant select on published.portfolio_publications, published.portfolio_items, published.public_evidence to anon, authenticated;

create policy profiles_owner on app.profiles for all to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy connections_owner on app.integration_connections for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy audit_owner_read on app.audit_events for select to authenticated
using (owner_id = (select auth.uid()));
create policy idempotency_owner on app.idempotency_keys for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy runs_owner on app.automation_runs for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy run_steps_owner on app.automation_run_steps for all to authenticated
using (exists (select 1 from app.automation_runs r where r.id = run_id and r.owner_id = (select auth.uid())))
with check (exists (select 1 from app.automation_runs r where r.id = run_id and r.owner_id = (select auth.uid())));
create policy public_active_publication on published.portfolio_publications for select to anon, authenticated
using (status = 'published');
create policy public_active_items on published.portfolio_items for select to anon, authenticated
using (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.status = 'published'));
create policy public_active_evidence on published.public_evidence for select to anon, authenticated
using (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.status = 'published'));

create or replace function api.me()
returns table (id uuid, display_name text, headline text, bio text, location text, timezone text, locale text)
language sql stable security invoker
set search_path = pg_catalog, app, auth
as $$ select p.id, p.display_name, p.headline, p.bio, p.location, p.timezone, p.locale
from app.profiles p where p.id = (select auth.uid()) $$;
grant execute on function api.me() to authenticated;
