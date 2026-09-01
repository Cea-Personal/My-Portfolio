-- Refresh PostgREST's relation cache after exposing the `app` schema.
-- Without this, Supabase Cloud can return PGRST205 for existing app tables.
notify pgrst, 'reload schema';
