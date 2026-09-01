# Quickstart validation

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
