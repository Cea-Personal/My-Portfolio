# Requirement traceability

The selected release maps each functional requirement to a user-story task and executable check.
Contracts live under `tests/contract`, deterministic domain checks live beside their package, and
database isolation checks live under `supabase/tests`. The source of truth is `tasks.md`; task IDs
are kept in commit history and CI output.

| Area | Primary artifacts | Verification |
| --- | --- | --- |
| Trusted facts/evidence | `packages/career`, `packages/knowledge`, migrations `0010–0015` | unit, worker, RLS tests |
| Public portfolio/intelligence | `apps/web/app/(public)`, `packages/ai` | contract, a11y, E2E tests |
| Opportunities/applications | `packages/jobs`, `packages/applications` | deterministic domain tests |
| Interviews/writing/analytics | `packages/interviews`, `packages/analytics`, `packages/career` | unit and privacy tests |
| Automation controls | `packages/observability`, `packages/auth` | resilience and denylist tests |

## Convergence evidence — 2026-09-04

| Gate | Evidence | Status |
| --- | --- | --- |
| Hosted schema and vector index | Supabase migrations `0001–0118`; six completed `app.chunk_embeddings` rows; linked lint exits 0 | PASS |
| Hosted validation runner | `scripts/hosted-pgtap.mjs` executes committed SQL with SSL and no database URL in process arguments; 13 files passed against `Portfolio_Test` | PASS |
| Public UX/accessibility | Chromium axe + responsive/zoom/keyboard/reduced-motion suite | PASS |
| AI safety/evaluation | 6 deterministic eval cases, 5 adversarial cases, targeted retrieval/JD/artifact/interview tests, contracts, and worker tests pass; production-provider corpus gate remains open | PARTIAL |
| Hosted pgTAP/RLS | `scripts/hosted-pgtap.mjs` passed all 13 rollback-only SQL files against isolated seeded `Portfolio_Test`, including Storage/publication boundaries | PASS |
| Browser compatibility | Firefox exits before launch (`libmozglue.dylib` missing); WebKit unavailable locally | OPEN |
| Performance | k6 not installed; release profile is fail-closed | OPEN |
| Recovery | Isolated backup/restore drill requires hosted release credentials | OPEN |
