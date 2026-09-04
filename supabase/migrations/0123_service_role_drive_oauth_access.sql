-- Drive OAuth callback, folder listing, and synchronization execute with the
-- service-role JWT. RLS bypass does not imply PostgreSQL table privileges.
grant usage on schema app to service_role;

grant select, insert, update
on app.integration_connections,
   app.drive_oauth_states
to service_role;

grant select, insert, update, delete
on app.integration_oauth_credentials
to service_role;

notify pgrst, 'reload schema';
