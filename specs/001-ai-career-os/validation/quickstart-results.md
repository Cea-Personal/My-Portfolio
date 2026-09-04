# Quickstart validation

Entries below are dated checkpoints. The 2026-09-04 entry is authoritative for the current hosted
schema and explicitly distinguishes application lint findings from pgTAP extension diagnostics.

Automated validation completed 2026-09-01 with Node 26.6 (the repository pins Node 24), pnpm 11.25,
and Python 3.13.5. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, 56 unit tests, 13 contract
tests, 8 integration tests, 11 security tests, 3 AI-evaluation tests, worker ruff/mypy, 11 worker
tests, and the webpack production build passed. The available Chromium and mobile-Chrome browser
matrix (20 E2E tests) and two accessibility checks passed. Firefox/WebKit binaries are not installed;
the full matrix therefore remains a release gate. `pnpm test:db` requires Docker/Supabase local state,
and `pnpm test:performance` requires k6; both remain runnable scripts in `package.json`.

Supabase Cloud project `Portfolio` was linked and the pending `0090_convergence_security.sql` and
`0091_convergence_integrity.sql` migrations applied successfully. A linked dry run reports the remote
database up to date, and `supabase db lint --linked` reports no schema errors.

## Convergence follow-up — 2026-09-01

The linked Supabase Cloud project now includes `0092_expose_app_schema.sql` and
`0093_reload_postgrest_schema.sql`. The `app` schema is exposed to PostgREST, its relation cache is
fresh, all migrations are applied, and `supabase db lint --linked` reports no schema errors.

The following local validation gates passed: lint, TypeScript typecheck, formatting, 13 contract tests,
8 integration tests, 16 security tests, 11 worker tests with ruff/mypy, Chromium responsive/a11y/Ask
Basil journeys, and the 6-test deterministic AI-evaluation suite (plus 5 adversarial and 4 AI package
unit tests). `supabase test db` remains unavailable in
this environment because it requires a local Docker-backed Supabase instance; performance validation
also remains an external release gate because `k6` is not installed.

## Convergence follow-up — 2026-09-04

Supabase Cloud is aligned through migration `0115_restore_publication_search_path.sql`. A read-only service-role
verification found two uploaded PDFs, two completed ingestion runs, two evidence sources/versions, six
chunks, six non-null `vector(1536)` embeddings, and 42 extracted fact candidates. The targeted
Chromium responsive/accessibility/Ask Basil gates, 6 AI-evaluation tests, 5 adversarial tests, and
16 security tests passed. The
release workflow now has fail-closed credential/tool checks and uploads evidence artifacts. Linked
`supabase db lint --linked` exits successfully and no longer reports the application `digest` or
`jsonb_object_length` errors; it still prints static-analysis diagnostics from pgTAP's dynamic helper
functions. Hosted pgTAP execution, Firefox/WebKit, k6, and backup/restore remain explicitly open until
their isolated release environment prerequisites are available.
