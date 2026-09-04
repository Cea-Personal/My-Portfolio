-- Personal-Drive OAuth is retired in favor of a service account that is given
-- Viewer access to one dedicated folder. Revoking legacy connection rows fires
-- the existing credential-deletion trigger, removing stored refresh tokens.
update app.integration_connections
set status = 'revoked',
    last_error_code = 'USER_OAUTH_DISABLED'
where provider = 'drive'
  and connection_type = 'oauth'
  and status <> 'revoked';

delete from app.drive_oauth_states;
revoke insert on app.drive_oauth_states from authenticated;
drop policy if exists drive_oauth_states_owner_insert on app.drive_oauth_states;

notify pgrst, 'reload schema';
