-- Scheduled and outbox workflows run with the service-role JWT. RLS bypass
-- does not imply PostgreSQL table privileges, so grant only their required operations.
grant usage on schema app to service_role;

grant select, update
on app.automation_schedules,
   app.outbox_events
to service_role;

grant select, insert, update
on app.automation_runs,
   app.automation_dead_letters
to service_role;

notify pgrst, 'reload schema';
