-- Private API mutations write an audit event after the business operation.
-- Allow only the authenticated owner actor to create their own owner audit row;
-- workflow/provider/system events continue to use service_role paths.
grant insert on app.audit_events to authenticated;

drop policy if exists audit_owner_insert on app.audit_events;
create policy audit_owner_insert on app.audit_events
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and actor_type = 'owner'
  and actor_id = (select auth.uid())
);
