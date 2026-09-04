# ADR 0001: implementation deviations

The initial scaffold uses in-memory domain ports and deterministic provider fakes while Supabase and
external providers are configured. The ports mirror the production contracts so replacing a fake does
not change authorization, evidence, or workflow semantics.

## Hosted validation and PostgreSQL compatibility

Hosted Supabase validation uses `scripts/hosted-pgtap.mjs` with an isolated `SUPABASE_DB_URL`. The
Supabase CLI's `test db --linked` path still boots a local Docker test container, so it is retained for
local development while the release workflow executes the same committed SQL files directly with
`psql`. Migrations 0113–0115 keep the existing publication function secure-definer search path while
adapting pgcrypto's Supabase-managed `extensions` schema and replacing the unavailable
`jsonb_object_length` call with an equivalent bounded key count.
