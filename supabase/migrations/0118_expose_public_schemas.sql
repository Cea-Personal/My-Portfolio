-- The public portfolio reads from api views and published projections through
-- PostgREST. 0092 exposed only app for the owner workspace, which left the
-- public schemas returning PGRST106 (Invalid schema) on Supabase Cloud.
-- Keep the schema list explicit so private/internal schemas are not exposed.
alter role authenticator set pgrst.db_schemas = 'public, app, api, published, graphql_public';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
