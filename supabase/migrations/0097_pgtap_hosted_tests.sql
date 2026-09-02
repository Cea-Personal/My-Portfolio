-- pgTAP is required by the committed hosted database policy suite. Keep its
-- functions in the extensions schema and let test files opt into that path.
create extension if not exists pgtap with schema extensions;
