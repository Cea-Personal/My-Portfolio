# Database conventions

Supabase/Postgres is the only persistence layer. Domain access must use the scoped repository factories
(`owner`, `public`, or `workflow`) and generated types in `src/generated/database.types.ts`; a second ORM
is intentionally not permitted. Private tables live in `app`, immutable public projections in `published`,
and allowlisted security-invoker views/functions in `api`.
