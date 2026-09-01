# Release evidence record

Validation run: 2026-09-01 (local synthetic fixtures; no hosted credentials).

Copy this template for each release candidate. Keep fixture data synthetic and store reports outside the
repository when they contain provider or deployment metadata.

| Gate                                 | Command/profile                                                       | Result                              | Revision/schema | Evidence location         |
| ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------- | --------------- | ------------------------- |
| Hosted Supabase migrations/RLS/pgTAP | `supabase db push --dry-run`, `supabase test db --linked`             | blocked: no linked project/local DB | n/a             | external staging required |
| Unit, contract, integration          | `pnpm test:unit` (46 files/54 tests), contracts (13), integration (8) | passed                              | local           | CI logs                   |
| E2E and accessibility                | Chromium E2E (10), Chromium Axe (1)                                   | passed                              | local           | Playwright report         |
| Performance                          | `pnpm test:performance` (mobile profile)                              | blocked: k6 not installed           | n/a             | install k6 in CI          |
| AI grounding/evaluation              | `pnpm test:ai-evals` (3 tests)                                        | passed                              | local           | Vitest output             |
| Adversarial security/telemetry       | `pnpm test:security` (7 files/11 tests)                               | passed                              | local           | Vitest output             |
| Worker lint/types/tests              | `pnpm lint:worker`, `pnpm test:worker` (9 tests)                      | passed                              | local           | pytest output             |
| Production build                     | `pnpm build`                                                          | passed                              | local           | Next build output         |
| Backup/restore                       | provider backup and owner-mapping drill                               | pending: hosted project required    | n/a             | external staging required |

Record the hosted project ref, migration checksum, fixture dataset hash, application revision, prompt and
retrieval versions, measured timings, and human approver. A pending or skipped gate is not a production
approval.
