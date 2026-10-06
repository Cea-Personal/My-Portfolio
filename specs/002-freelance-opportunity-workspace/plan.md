# Implementation Plan: Freelance Opportunity Workspace

**Branch**: `002-freelance-opportunity-workspace` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

## Summary

Add an authenticated freelance workspace to Career OS by extending the existing jobs opportunity backbone with a freelance domain, a provider-neutral `OpportunityProvider` contract, and an `UpworkProvider` that supports manual imports immediately while reserving OAuth/API fetches for a future connection-enabled capability. The initial delivery will reuse Career Brain retrieval, application artifact/versioning, compensation logic, existing private API authorization, and the existing agent harness. Proposal approval and external submission recording remain explicit owner actions.

The term “initial product capability” describes the distinction between manual Upwork import and future Upwork API/OAuth ingestion. The implementation delivery phases below are separate engineering milestones and do not redefine that capability boundary.

## Technical Context

**Language/Version**: TypeScript on Node.js 24; Next.js App Router; SQL migrations for PostgreSQL/Supabase; existing Python worker remains unchanged for this milestone.

**Primary Dependencies**: Next.js, Supabase client/RLS, Inngest, Vitest, Playwright, `@career-os/jobs`, `@career-os/knowledge`, `@career-os/compensation`, `@career-os/applications`, and existing AI orchestration.

**Storage**: PostgreSQL in the `app` schema. Existing `app.jobs`, `app.job_descriptions`, Career Brain evidence/retrieval tables, applications, artifacts, AI runs, and workflow state are reused. New freelance tables are owner-scoped and append/version oriented.

**Testing**: Vitest unit/contract/integration tests, Supabase pgTAP authorization tests, Playwright end-to-end/accessibility tests, and AI evaluation fixtures for insufficient evidence and malicious opportunity text.

**Target Platform**: Authenticated web workspace, responsive desktop/tablet/mobile browsers, and existing server/workflow runtime.

**Project Type**: Existing monorepo web application with shared TypeScript packages and a Supabase database.

**Performance Goals**: Manual import response under 1 second excluding asynchronous analysis; list/detail reads under 500ms p95 for normal owner data volumes; analysis and proposal generation expose progress and retry state rather than blocking the page.

**Constraints**: Owner-only access; database-backed RLS; no Upwork scraping or external submission; no provider secrets in the client; untrusted opportunity text cannot become instructions; deterministic score/pricing/state logic; proposal approval requires evidence or owner edits; existing employment job behavior must remain compatible.

**Scale/Scope**: One owner in the initial workspace capability; up to thousands of owner opportunities; manual Upwork ingestion, analysis, evidence matching, proposal drafting, pricing, approval, and manual submission tracking. The manual-versus-OAuth/API distinction describes ingestion capability only; it does not define the broader product or engineering scope. Client risk, contracts, delivery, and notifications remain later engineering milestones from the approved implementation outline.

## Constitution Check

### Pre-Design Gate

- **I, II, III, IV, XII, XIV, XVI**: Pass. Career Brain remains canonical; evidence links, provenance, owner review, contribution attribution, and immutable proposal versions are first-class requirements.
- **V, XIII, XV**: Pass. New records are private by default, owner-scoped through API and RLS, and excluded from public retrieval. Attachments and opportunity text are never public automatically.
- **VI**: Pass. Proposal approval and manual submission recording are separate explicit actions; no external submission tool is introduced.
- **VII**: Pass. Import validation, normalization, scoring arithmetic, pricing arithmetic, deduplication, state transitions, authorization, and analytics are deterministic.
- **VIII, IX**: Pass. `OpportunityProvider` isolates provider behavior; `UpworkProvider` has manual support now and future API/OAuth capability without scraping. External text is untrusted and safe-fetch behavior is reused for later provider work.
- **X, XI**: Pass. Async work uses existing durable workflow identities, retries, and failure records; tests cover grounding, missing evidence, malicious input, provider capability errors, and privacy.
- **XVII**: Pass. Workspace design includes semantic forms, keyboard/focus support, reduced motion, loading/empty/error/retry states, and responsive layout.
- **XVIII**: Pass. This feature has a specification, plan, research, data model, contracts, quickstart, and dependency-ordered tasks before implementation.

### Post-Design Gate

The design keeps the existing employment domain intact, uses the fewest new deployable components (one package, web routes, and migrations), and does not require a constitutional exception.

## Research Summary

The detailed decisions are recorded in [research.md](./research.md). The important choices are:

1. Use `app.jobs` as the canonical opportunity identity and add a freelance sidecar rather than creating a second top-level opportunity store.
2. Add a dedicated freelance score table because existing employment scoring has different factors and weights.
3. Reuse existing Career Brain retrieval and evidence provenance instead of creating a freelance-only RAG index.
4. Reuse existing application/artifact/version infrastructure while adding freelance proposal state and evidence gates.
5. Make manual Upwork normalization fully operational and make API/OAuth provider methods explicit capability errors until a connection is configured.

## Project Structure

### Documentation

```text
specs/002-freelance-opportunity-workspace/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
└── quickstart.md
```

### Source Code

```text
packages/freelance/
└── src/
    ├── index.ts
    ├── types.ts
    ├── normalization.ts
    ├── scoring.ts
    ├── pricing.ts
    ├── state.ts
    ├── evidence.ts
    └── providers/
        ├── contract.ts
        ├── registry.ts
        └── upwork.ts

apps/web/app/(dashboard)/freelance/
├── page.tsx
└── [id]/page.tsx

apps/web/app/api/v1/freelance/
├── opportunities/route.ts
├── opportunities/[id]/route.ts
├── opportunities/[id]/analyze/route.ts
├── opportunities/[id]/score/route.ts
├── opportunities/[id]/evidence/route.ts
├── opportunities/[id]/pricing/route.ts
├── opportunities/[id]/proposal/route.ts
├── proposals/[id]/versions/route.ts
├── proposals/[id]/transitions/route.ts
├── proposals/[id]/approve/route.ts
├── proposals/[id]/record-submission/route.ts
└── analytics/route.ts

apps/web/components/dashboard/freelance/
├── index.tsx
├── detail.tsx
├── manual-import-form.tsx
├── opportunity-analysis.tsx
├── proposal-editor.tsx
└── pricing-card.tsx

supabase/migrations/0155_freelance_workspace.sql
supabase/tests/100_freelance.test.sql
tests/contract/freelance-api.contract.test.ts
tests/integration/freelance-workflow.test.ts
tests/e2e/freelance.spec.ts
tests/accessibility/freelance.spec.ts
```

**Structure Decision**: Keep the current monorepo and one web application. The new `packages/freelance` package owns reusable freelance-domain contracts and deterministic logic. Web routes own authentication, persistence orchestration, and UI. Existing jobs, applications, knowledge, compensation, analytics, observability, and AI packages remain shared dependencies rather than duplicated implementations.

## Delivery Phases

### Phase A — Foundation

- Create the freelance package and provider contract.
- Add schema migration, RLS, indexes, and typed database contracts.
- Add task/event names and deterministic state/scoring/pricing primitives.

### Phase B — Opportunity intake and intelligence

- Add manual Upwork import and deduplication.
- Add opportunity list/detail UI and API.
- Add analysis, score, evidence matching, and evidence-gap views.

### Phase C — Proposal and approval workflow

- Add pricing recommendations and versioned proposal drafting.
- Add evidence-aware approval gate, CRM transitions, and manual submission recording.
- Add proposal feedback capture and workflow observability.

### Phase D — Validation and hardening

- Run unit, contract, integration, database authorization, security, accessibility, and end-to-end tests.
- Validate quickstart scenarios and document future Upwork connection behavior.

The manual-import capability boundary is independent of these engineering milestones. The initial implementation milestone supports manual Upwork import; subsequent engineering milestones may add client risk, case studies, interview preparation, contracts, delivery, and provider API/OAuth execution as specified in the approved implementation outline.

## Complexity Tracking

No constitutional violations or additional deployable services are required.
