# Tasks: Freelance Opportunity Workspace

**Input**: Design documents from `/specs/002-freelance-opportunity-workspace/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

## Engineering milestone 0: Setup

- [X] T001 Add the `@career-os/freelance` package workspace metadata in `packages/freelance/package.json` and register it in the root workspace configuration.
- [X] T002 [P] Add freelance package TypeScript configuration and public exports in `packages/freelance/tsconfig.json` and `packages/freelance/src/index.ts`.
- [ ] T003 [P] Add the freelance database migration and migration test file placeholders in `supabase/migrations/0155_freelance_workspace.sql` and `supabase/tests/100_freelance.test.sql`.

## Engineering milestone 1: Foundation

- [X] T004 Implement shared freelance domain types, validation schemas, enums, and score/pricing constants in `packages/freelance/src/types.ts`.
- [X] T005 Implement the provider contract, registry, and capability error model in `packages/freelance/src/providers/contract.ts` and `packages/freelance/src/providers/registry.ts`.
- [X] T006 [P] Implement deterministic normalization and fingerprinting for manual opportunities in `packages/freelance/src/normalization.ts`.
- [X] T007 [P] Implement deterministic eight-factor scoring, owner-configurable weights, and recommendation thresholds in `packages/freelance/src/scoring.ts`.
- [X] T008 [P] Implement freelance pricing arithmetic and validation in `packages/freelance/src/pricing.ts`.
- [X] T009 [P] Implement proposal CRM/approval state transitions and invalid-transition errors in `packages/freelance/src/state.ts`.
- [X] T010 Implement the `UpworkProvider` manual import path and explicit future API/OAuth capability errors in `packages/freelance/src/providers/upwork.ts`.
- [X] T011 Add package unit tests for provider behavior, normalization, score arithmetic, pricing, and state transitions in `packages/freelance/src/*.test.ts`.
- [X] T012 Implement the freelance schema, constraints, indexes, owner RLS policies, and migration grants in `supabase/migrations/0155_freelance_workspace.sql`.
- [ ] T013 Add pgTAP tests for owner isolation, uniqueness, score/pricing constraints, and approval state guards in `supabase/tests/100_freelance.test.sql`.

## Engineering milestone 2: User Story 1 — Import and Prioritize a Freelance Opportunity (P1)

**Goal**: An owner can manually import an Upwork opportunity, analyze it, score it, and view evidence matches.

**Independent test**: Complete Quickstart Scenarios 1 and 2 without using an Upwork API connection.

- [ ] T014 [P] [US1] Add API contract tests for opportunity list/create/detail, duplicate import, analyze, score, and evidence routes in `tests/contract/freelance-api.contract.test.ts`.
- [ ] T015 [P] [US1] Add integration coverage for manual import, normalization, analysis persistence, deterministic score persistence, and evidence retrieval in `tests/integration/freelance-workflow.test.ts`.
- [ ] T016 [US1] Implement owner-scoped opportunity list/create/detail/update routes in `apps/web/app/api/v1/freelance/opportunities/route.ts` and `apps/web/app/api/v1/freelance/opportunities/[id]/route.ts`.
- [X] T017 [US1] Implement manual Upwork persistence, client upsert, canonical job/description creation, deduplication, and status initialization in `apps/web/lib/server/freelance-opportunities.ts`.
- [ ] T018 [US1] Implement analysis request/status persistence and Career Brain requirement/evidence retrieval in `apps/web/app/api/v1/freelance/opportunities/[id]/analyze/route.ts`, `apps/web/app/api/v1/freelance/opportunities/[id]/evidence/route.ts`, and `packages/freelance/src/evidence.ts`.
- [X] T019 [US1] Extend the existing AI task registry and native output schemas for freelance opportunity analysis and evidence-gap output in `packages/ai/src/orchestrator.ts` and `apps/web/lib/server/codex-app-server.ts`.
- [ ] T020 [US1] Register freelance analysis workflow events and durable execution metadata in `apps/web/inngest/durable-domain-events.ts` and the relevant `apps/web/inngest/freelance-opportunity.ts` workflow module.
- [ ] T021 [US1] Implement deterministic score API persistence and latest-score retrieval in `apps/web/app/api/v1/freelance/opportunities/[id]/score/route.ts` and `apps/web/lib/server/freelance-scoring.ts`.
- [X] T022 [US1] Build the authenticated freelance list/dashboard and manual import UI in `apps/web/app/(dashboard)/freelance/page.tsx`, `apps/web/components/dashboard/freelance/index.tsx`, and `apps/web/components/dashboard/freelance/manual-import-form.tsx`.
- [ ] T023 [US1] Build the opportunity detail, analysis, score, evidence, loading, empty, error, retry, keyboard, and reduced-motion states in `apps/web/app/(dashboard)/freelance/[id]/page.tsx`, `apps/web/components/dashboard/freelance/detail.tsx`, and `apps/web/components/dashboard/freelance/opportunity-analysis.tsx`.
- [X] T024 [US1] Add Freelance to the authenticated navigation without changing public portfolio navigation in `apps/web/app/(dashboard)/layout.tsx`.
- [ ] T025 [US1] Add end-to-end coverage for manual import, duplicate handling, analysis/score display, and accessible workspace states in `tests/e2e/freelance.spec.ts` and `tests/accessibility/freelance.spec.ts`.

## Engineering milestone 3: User Story 2 — Build an Evidence-Grounded Proposal (P1)

**Goal**: An owner can retrieve evidence, identify gaps, obtain pricing, and generate a versioned proposal draft with provenance.

**Independent test**: Complete Quickstart Scenario 3 through the rejected unsupported-claim approval attempt.

- [ ] T026 [P] [US2] Add proposal, pricing, evidence-provenance, and unsupported-claim contract tests in `tests/contract/freelance-api.contract.test.ts`.
- [ ] T027 [P] [US2] Add integration tests for pricing snapshots, proposal versions, claim evidence links, and approval gating in `tests/integration/freelance-workflow.test.ts`.
- [X] T028 [US2] Implement pricing retrieval/generation and deterministic recalculation in `packages/freelance/src/pricing.ts` and `apps/web/app/api/v1/freelance/opportunities/[id]/pricing/route.ts`.
- [X] T029 [US2] Implement proposal generation context, evidence provenance, unsupported-claim flags, and version persistence in `apps/web/lib/server/freelance-ai.ts` and `apps/web/app/api/v1/freelance/opportunities/[id]/proposal/route.ts`.
- [X] T030 [US2] Extend the existing application-writer task mapping and structured output schemas for concise freelance proposals in `packages/ai/src/orchestrator.ts`, `apps/web/lib/server/codex-app-server.ts`, and `.codex/agents/application-writer.toml`.
- [ ] T031 [US2] Link approved freelance proposal artifacts to existing application/version/evidence infrastructure in `packages/applications/src/` and `apps/web/lib/server/freelance-proposal-generation.ts`.
- [ ] T032 [US2] Build proposal editor, evidence references, unsupported-claim warnings, pricing card, and feedback controls in `apps/web/components/dashboard/freelance/proposal-editor.tsx`, `apps/web/components/dashboard/freelance/pricing-card.tsx`, and `apps/web/components/dashboard/freelance/detail.tsx`.

## Engineering milestone 4: User Story 3 — Review and Track the Application Decision (P1)

**Goal**: An owner can review, approve, transition, and manually record a proposal submission without external automation.

**Independent test**: Complete Quickstart Scenario 3 from ready-for-review through manually recorded submission and confirm no provider submit call occurs.

- [ ] T033 [P] [US3] Add contract tests for proposal versions, CRM/approval transitions, approval rejection, and manual submission recording in `tests/contract/freelance-api.contract.test.ts`.
- [ ] T034 [P] [US3] Add integration tests for valid/invalid state transitions, stale-version rejection, explicit approval, and no-external-submit behavior in `tests/integration/freelance-workflow.test.ts`.
- [X] T035 [US3] Implement proposal version creation and owner edit routes in `apps/web/app/api/v1/freelance/proposals/[id]/versions/route.ts`.
- [X] T036 [US3] Implement deterministic CRM transitions and append-only history in `apps/web/app/api/v1/freelance/proposals/[id]/transitions/route.ts` and `supabase/migrations/0155_freelance_workspace.sql`.
- [X] T037 [US3] Implement evidence-gated approval and explicit manual submission recording in `apps/web/app/api/v1/freelance/proposals/[id]/approve/route.ts` and `apps/web/app/api/v1/freelance/proposals/[id]/record-submission/route.ts`.
- [ ] T038 [US3] Add proposal timeline, approval controls, transition errors, and manual submission confirmation UI in `apps/web/components/dashboard/freelance/detail.tsx` and `apps/web/components/dashboard/freelance/proposal-editor.tsx`.
- [X] T039 [US3] Add deterministic freelance funnel analytics and owner-scoped analytics route in `packages/analytics/src/freelance-funnel.ts`, `packages/analytics/src/index.ts`, and `apps/web/app/api/v1/freelance/analytics/route.ts`.

## Engineering milestone 5: Polish and Cross-Cutting Validation

- [ ] T040 [P] Add security tests for prompt injection, private attachment handling, safe provider capability errors, and cross-owner access in `tests/security/freelance.security.test.ts`.
- [ ] T041 [P] Add provider contract tests proving manual Upwork support and disabled API/OAuth behavior in `tests/contract/upwork-provider.contract.test.ts`.
- [ ] T042 [P] Add AI evaluation fixtures for insufficient evidence, conflicting evidence, unsupported claims, and client-text injection in `tests/evals/freelance-opportunity.eval.test.ts`.
- [X] T043 [P] Add documentation for manual Upwork workflow and future connection enablement in `docs/runbooks/freelance.md`.
- [ ] T044 Run the feature quickstart, typecheck, focused unit/contract/integration tests, database tests, accessibility tests, and end-to-end tests; record any pre-existing failures separately in `specs/002-freelance-opportunity-workspace/quickstart.md`.
- [ ] T045 Review generated artifacts, telemetry, logs, and cache keys for privacy, provenance, prompt/model versioning, and owner-boundary compliance across the changed modules.

## Dependencies and execution order

- Setup tasks T001–T003 must complete before foundational package/schema work.
- Foundational tasks T004–T013 block all user stories.
- User Story 1 is the MVP and must complete before proposal generation in User Story 2.
- User Story 3 depends on the proposal aggregate and versions from User Story 2.
- T014/T015, T026/T027, T033/T034, and T040–T043 can run in parallel within their phases when their target files do not conflict.
- T024 is independent of the API implementation but should land before end-to-end navigation tests.

## Implementation strategy

1. Complete the package/provider/schema foundation.
2. Deliver User Story 1 as the first demonstrable increment: manual Upwork import, analysis, score, evidence, and dashboard.
3. Add proposal/pricing generation and evidence gating.
4. Add explicit review/tracking and analytics.
5. Finish with security, AI evaluation, accessibility, and quickstart validation.

All tasks are written with exact file paths, a traceable story label where applicable, and an independently verifiable outcome.

**Phase terminology**: The engineering milestones above are for implementation ordering. Separately, the product-capability boundary is manual Upwork import now versus OAuth/API ingestion through a future connection-enabled adapter. These are independent distinctions.
