# Supabase

Run migrations in order, verify RLS and storage policies, and keep service-role credentials off the
client. Backups and restores require an owner mapping check.

## Hosted project workflow

Use a separate hosted staging project first. The CLI workflow is:

```bash
supabase login
supabase link --project-ref <staging-project-ref>
supabase db push --dry-run
supabase db push
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only
`SUPABASE_SERVICE_ROLE_KEY` from the hosted project in the deployment environment. Configure the
hosted Auth Site URL and `/auth/callback` redirect URL for the deployed domain. Keep production and
staging projects separate, and apply future schema changes only through committed migration files.
The private BFF uses the authenticated user JWT with RLS, so expose the `app`, `api`, and `published`
schemas in the hosted project's API settings; `app` remains inaccessible to anonymous users through
its grants and policies.

Before production promotion, run the acceptance seed and RLS checks against staging, verify storage
policies, and take a backup. Never commit `.env.local`, database passwords, access tokens, or service
role keys.

## Cloud staging verification

After linking a free Supabase Cloud project, run the same committed migrations and checks against that
project; no self-hosted Supabase or local Docker runtime is required:

```bash
supabase link --project-ref <staging-project-ref>
supabase db push --dry-run
supabase db push
supabase test db --linked
```

Use a disposable owner account and fixture-only data. Confirm `published` is readable only for active
publications, every `app` table denies anonymous and cross-owner access, append-only triggers reject
updates/deletes, and storage URLs are short-lived. Record the project ref, migration version, fixture
hash, and test output in the release evidence; never paste credentials into the repository or CI logs.
