# Hosted Supabase validation (T317)

The repository is linked to the isolated hosted `Portfolio_Test` Supabase project. Migrations through
0118 were applied, then `supabase/seed/acceptance.sql` loaded deterministic synthetic owner, career,
evidence, and published-portfolio fixtures. The seed contains no personal data or provider credentials.

On 2026-09-04, the guarded `pnpm test:db:hosted` runner passed all 13 SQL files transactionally:

- foundation, career, evidence, retrieval, jobs, applications/artifacts, interviews/journal, blog,
  analytics, automation, convergence security, and convergence integrity;
- Storage bucket/object registries and owner policies;
- public publication and portfolio-item API view boundaries.

Each test file runs inside `BEGIN`/`ROLLBACK`, so the gate verifies constraints and authorization without
leaving test mutations behind. The hosted project remains isolated from the production `Portfolio`
project.
