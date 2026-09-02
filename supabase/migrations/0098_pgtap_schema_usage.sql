-- The linked pgTAP runner resolves its test functions through the extensions
-- schema. Schema usage is needed for name resolution; this does not grant
-- access to private app relations.
grant usage on schema extensions to public;
