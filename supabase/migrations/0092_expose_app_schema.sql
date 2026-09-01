-- The authenticated owner workspace uses PostgREST through the `app` schema.
-- Supabase Cloud exposes only `public` by default, so requests otherwise fail
-- with PGRST106 (Invalid schema: app) even for a valid authenticated session.
alter role authenticator set pgrst.db_schemas = 'public, app, graphql_public';

notify pgrst, 'reload config';
