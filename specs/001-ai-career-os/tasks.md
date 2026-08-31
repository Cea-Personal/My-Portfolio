# Tasks: AI Career OS and Intelligent Portfolio

**Input**: Design documents from `/specs/001-ai-career-os/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
constitution v1.0.0

**Tests**: Required by the feature specification and constitution. Within each story, write the listed
tests first and confirm they fail for the expected missing behavior before implementing that story.

**Organization**: Tasks are grouped by user story. Seeded fixtures permit isolated test development, but
they do not remove the production schema and service dependencies recorded below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent `[P]` tasks because it targets different files and has no
  dependency on another incomplete task in that batch.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every task names the exact file or path it creates or modifies.
- Every task ID is a normative reference into the Task Metadata Matrix. The matrix supplies its required
  requirement mapping, hard dependencies, completion criteria, and verification method; the task line
  supplies its likely module/file. Both the task line and matrix row MUST be satisfied before completion.

## Task Metadata Matrix *(normative)*

| Task IDs | Requirements | Hard dependencies | Completion criteria | Verification method |
|----------|--------------|-------------------|---------------------|---------------------|
| T001–T015 | Constitution XVIII; plan setup/toolchain constraints | Prior task where explicitly sequential; otherwise none | Named files exist, versions/configuration are pinned, and the Phase 1 checkpoint succeeds without production credentials | CI configuration validation plus Phase 1 checkpoint |
| T016–T045 | FR-001–FR-005; PSR-001–PSR-009; NFR-005–NFR-009; Constitution V–X | T001–T015 | Named security/platform behavior is implemented fail-closed with typed boundaries and fixtures | T023, T041, foundation test suites, and Phase 2 checkpoint |
| T046–T054 | FR-007–FR-027; ST-001–ST-002; SC-006–SC-008 | T016–T045 | Test exists, compiles, and fails for the expected missing behavior before implementation | Execute each named test and record expected pre-implementation failure |
| T055–T079 | FR-007–FR-027; ST-001–ST-002; SC-002, SC-006–SC-008 | T046–T054; migrations T055 -> T056 -> T057 -> T058 -> T059 -> T060 | Named behavior is implemented; implementation tests pass; US1 independent test passes | T046–T054 plus US1 checkpoint |
| T080–T084 | FR-028–FR-038; NFR-001–NFR-003; SC-001–SC-002, SC-016–SC-017; MP-001, MP-005–MP-006 | T016–T045; US1 publication schema | Test exists and produces the expected pre-implementation failure | Execute each named test under the defined measurement profiles |
| T085–T098 | FR-028–FR-038; NFR-001–NFR-003; SC-001–SC-002, SC-016–SC-017; MP-001, MP-005–MP-006 | T080–T084; T055–T060 | Public portfolio behavior and budgets pass from active publication data | T080–T084 plus US2 checkpoint |
| T099–T106 | FR-039–FR-050; AIR-001–AIR-008; SC-003–SC-005; NFR-004; MP-003 | T016–T045; seeded public evidence for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named contract, evaluation, security, and browser test |
| T107–T124 | FR-039–FR-050; AIR-001–AIR-008; SC-003–SC-005; NFR-004; MP-003 | T099–T106; T055–T060; T085–T098 for integrated public rendering | Grounded retrieval/chat/matching behavior passes deterministic validation and public-boundary tests | T099–T106 plus US3 checkpoint |
| T125–T131 | FR-051–FR-068; ST-003; SC-009–SC-011 | T016–T045; seeded Career Brain evidence for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named database, adapter, domain, workflow, contract, and browser test |
| T132–T153 | FR-051–FR-068; ST-003; SC-009–SC-011 | T125–T131; T055–T060; migrations T132 -> T133 -> T134 | Job discovery/tracking behavior passes source-isolation, dedupe, scoring, and history checks | T125–T131 plus US4 checkpoint |
| T154–T161 | FR-069–FR-092; ST-004; SC-012–SC-013 | T016–T045; seeded job/application/evidence for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named database, schema, evidence, render, contract, and browser test |
| T162–T180 | FR-069–FR-092; ST-004; SC-012–SC-013 | T154–T161; T055–T060; T132–T134; migrations T162 -> T163 -> T164 | Complete private application workspace, documents, artifacts, and compensation behavior passes exact-version and no-submission checks | T154–T161 plus US5 checkpoint |
| T181–T187 | FR-093–FR-108; ST-005; SC-014–SC-015; MP-006 | T016–T045; seeded application/evidence for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named database, domain, contract, integrity, and browser test |
| T188–T205 | FR-093–FR-108; ST-005; SC-014–SC-015; MP-006 | T181–T187; T055–T060; T162–T164 | Interview preparation and learning behavior passes integrity and no-live-assistance checks | T181–T187 plus US6 checkpoint |
| T206–T209 | FR-109–FR-113; ST-006 | T016–T045; seeded evidence/publication for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named database, domain, security, and browser test |
| T210–T220 | FR-109–FR-113; ST-006 | T206–T209; T055–T060; T085–T098 | Evidence-safe versioned writing workflow passes explicit publication checks | T206–T209 plus US7 checkpoint |
| T221–T226 | FR-114–FR-119; SC-021–SC-022 | T016–T045; seeded lifecycle/events for isolated tests | Test exists and produces the expected pre-implementation failure | Execute each named database, aggregate, privacy, and browser test |
| T227–T239 | FR-006, FR-114–FR-119; SC-021–SC-022 | T221–T226; production event/state producers from US2, US4, US5, US6, and US7 | Instrumented events reconcile to private reports within tolerance and dashboard actions link to authorized records | T221–T226, T239, and US8 checkpoint |
| T240–T245 | FR-120–FR-126; ST-007; NFR-005–NFR-009 | T016–T045; fake workflows/providers | Test exists and produces the expected pre-implementation failure | Execute each named database, contract, resilience, security, and browser test |
| T246–T258 | FR-120–FR-126; ST-007; NFR-005–NFR-009 | T240–T245; integrated workflow producers from selected stories | Owner can configure and inspect bounded AI/workflows; policy tests prove no consequential authority | T240–T245 plus US9 checkpoint |
| T259–T276 | All applicable FR/ST/AIR/PSR/NFR/SC; MP-001–MP-007; Constitution I–XVIII | Every story selected for release | Named release evidence exists, all applicable gates pass, and human approval is recorded | T259 traceability, T260–T275 validation evidence, and T276 signed review |

For each individual task, “named behavior” and “named files” mean every action and path enumerated in that
task’s exact row. Partial file creation or passing only a subset of the mapped verification cannot close
the task. A task may narrow a range-level dependency only when the change is recorded in this matrix.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the greenfield monorepo, toolchains, local services, and CI entry points.

- [ ] T001 Create the root pnpm workspace manifest with pinned Node/pnpm versions and scripts in `package.json`
- [ ] T002 Create workspace package discovery and task graph configuration in `pnpm-workspace.yaml` and `turbo.json`
- [ ] T003 [P] Scaffold the Next.js 16 App Router application and dependency manifest in `apps/web/package.json` and `apps/web/app/layout.tsx`
- [ ] T004 [P] Scaffold the Python 3.13 worker with uv locking and console entry point in `apps/worker/pyproject.toml` and `apps/worker/src/career_worker/__main__.py`
- [ ] T005 Create domain manifests in `packages/ai/package.json`, `packages/career/package.json`, `packages/knowledge/package.json`, `packages/jobs/package.json`, `packages/applications/package.json`, `packages/interviews/package.json`, `packages/compensation/package.json`, `packages/documents/package.json`, `packages/analytics/package.json`, `packages/database/package.json`, `packages/auth/package.json`, `packages/contracts/package.json`, `packages/ui/package.json`, `packages/config/package.json`, and `packages/observability/package.json`
- [ ] T006 [P] Configure strict shared TypeScript settings and path aliases in `tsconfig.base.json` and `packages/config/tsconfig.json`
- [ ] T007 [P] Configure TypeScript formatting, linting, and import-boundary rules in `eslint.config.mjs` and `.prettierrc.json`
- [ ] T008 [P] Configure Python linting, typing, test defaults, and dependency policy in `apps/worker/pyproject.toml` and `apps/worker/ruff.toml`
- [ ] T009 Create safe environment examples and validation documentation in `.env.example` and `apps/worker/.env.example`
- [ ] T010 [P] Configure the local Supabase project, schemas, and seed entry points in `supabase/config.toml` and `supabase/seed/README.md`
- [ ] T011 [P] Configure local Inngest development scripts and environment separation in `apps/web/inngest/client.ts` and `apps/worker/src/career_worker/workflows/client.py`
- [ ] T012 [P] Configure Vitest, pytest, Playwright, axe, and k6 test entry points in `vitest.config.ts`, `apps/worker/pytest.ini`, `playwright.config.ts`, and `tests/performance/k6.config.js`
- [ ] T013 [P] Configure a local OpenTelemetry Collector with an attribute allowlist and vendor-disabled defaults in `infra/observability/otel-collector.local.yaml`
- [ ] T014 [P] Create the digest-pinnable non-root worker container and health check in `infra/worker/Dockerfile` and `apps/worker/src/career_worker/health.py`
- [ ] T015 Create the base pull-request CI workflow for lint, types, units, migrations, contracts, and builds in `.github/workflows/ci.yml`

**Checkpoint**: The empty web app, worker, local database, workflow runner, test runners, and CI all start
without production credentials.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement security, contracts, persistence, workflow, observability, and UI primitives needed
by every user story.

**⚠️ CRITICAL**: No user story implementation starts until this phase passes its checkpoint.

- [ ] T016 Implement typed environment validation with public/server secret separation in `packages/config/src/env.ts` and `apps/worker/src/career_worker/config.py`
- [ ] T017 [P] Implement shared identifiers, timestamps, money, visibility, trust, and run-state schemas in `packages/contracts/src/common.ts`
- [ ] T018 [P] Implement RFC 9457 errors, safe error mapping, and correlation IDs in `packages/contracts/src/problems.ts` and `packages/observability/src/correlation.ts`
- [ ] T019 Implement server, browser, and middleware Supabase clients with private/no-store auth behavior in `packages/database/src/supabase/server.ts`, `packages/database/src/supabase/browser.ts`, and `apps/web/proxy.ts`
- [ ] T020 Implement and test authenticated owner session, current-profile API, and route/action authorization helpers plus sign-in, verified callback, sign-out, expired-session, and unauthorized UX in `packages/auth/src/session.ts`, `packages/auth/src/authorize.ts`, `apps/web/app/api/v1/me/route.ts`, `apps/web/app/(auth)/sign-in/page.tsx`, `apps/web/app/auth/callback/route.ts`, `apps/web/app/(auth)/session-expired/page.tsx`, `apps/web/app/(auth)/unauthorized/page.tsx`, `tests/security/auth-callback.test.ts`, and `tests/e2e/auth.spec.ts`
- [ ] T021 Create base `app`, `published`, and `api` schemas plus profiles, integration connections, audit, outbox, idempotency, and run tables in `supabase/migrations/0001_foundation.sql`
- [ ] T022 Apply default-deny grants, RLS policies, fixed-search-path functions, and security-invoker view rules in `supabase/migrations/0002_foundation_security.sql`
- [ ] T023 [P] Write pgTAP allow/deny tests for anonymous, owner, cross-owner, workflow, and service roles in `supabase/tests/001_foundation_rls.test.sql`
- [ ] T024 Configure private source/artifact buckets, sanitized public-media bucket, and object policies in `supabase/migrations/0003_storage_policies.sql`
- [ ] T025 Generate database types and establish the no-dual-ORM repository convention in `packages/database/src/generated/database.types.ts` and `packages/database/README.md`
- [ ] T026 [P] Implement distinct owner, public, and workflow repository factories in `packages/database/src/repositories/owner.ts`, `packages/database/src/repositories/public.ts`, and `packages/database/src/repositories/workflow.ts`
- [ ] T027 [P] Implement reusable revision and idempotency guards in `packages/database/src/idempotency.ts` and `packages/database/src/revision.ts`
- [ ] T028 [P] Implement append-only audit recording with metadata allowlists and the owner-only paged audit endpoint in `packages/database/src/audit.ts` and `apps/web/app/api/v1/audit-events/route.ts`
- [ ] T029 Implement transactional domain-event outbox writes and dispatcher leases in `packages/database/src/outbox.ts`
- [ ] T030 Implement the versioned workflow event envelope and runtime validators in `packages/contracts/src/events.ts` and `apps/worker/src/career_worker/contracts/events.py`
- [ ] T031 Implement the outbox-to-Inngest publisher with stable event IDs in `apps/web/inngest/outbox-publisher.ts`
- [ ] T032 [P] Implement the TypeScript Inngest serve endpoint and signed request verification in `apps/web/app/api/inngest/route.ts`
- [ ] T033 [P] Implement the Python Inngest serve application and signed request verification in `apps/worker/src/career_worker/workflows/serve.py`
- [ ] T034 Implement app-owned automation run/step repositories and status transitions in `packages/database/src/repositories/runs.ts` and `apps/worker/src/career_worker/repositories/runs.py`
- [ ] T035 Define provider-neutral generation, structured output, streaming, embedding, reranking, and tool-proposal ports in `packages/ai/src/ports.ts` and `apps/worker/src/career_worker/providers/ports.py`
- [ ] T036 [P] Implement deterministic fake adapters in `tests/fixtures/providers/ai.ts`, `tests/fixtures/providers/embeddings.ts`, `tests/fixtures/providers/reranker.ts`, `tests/fixtures/providers/drive.ts`, `tests/fixtures/providers/job-source.ts`, and `apps/worker/tests/fakes/providers.py`
- [ ] T037 Implement secret-reference and integration-configuration services without plaintext secret reads in `packages/config/src/secrets.ts` and `packages/auth/src/integrations.ts`
- [ ] T038 Implement explicit confirmation tokens for publish/final/submitted-record actions in `packages/auth/src/confirmation.ts`
- [ ] T039 Implement API schema validation, correlation, idempotency, origin/CSRF, and rate-limit middleware plus the shared redirect-aware HTTPS/SSRF/size/timeout safe-fetch boundary in `apps/web/lib/api/guard.ts` and `apps/web/lib/security/safe-fetch.ts`
- [ ] T040 Implement OpenTelemetry setup with metadata-only AI spans and keyed owner pseudonyms in `packages/observability/src/otel.ts` and `apps/worker/src/career_worker/observability.py`
- [ ] T041 [P] Write telemetry redaction tests for secrets, signed URLs, prompts, evidence, CVs, JDs, and journals in `tests/security/telemetry-redaction.test.ts` and `apps/worker/tests/test_telemetry_redaction.py`
- [ ] T042 Integrate sanitized Sentry errors and consent-gated PostHog clients in `packages/observability/src/sentry.ts` and `packages/analytics/src/posthog.ts`
- [ ] T043 [P] Implement design tokens, typography, focus, contrast, and reduced-motion defaults in `packages/ui/src/styles/tokens.css` and `packages/ui/src/styles/globals.css`
- [ ] T044 [P] Implement accessible primitives in `packages/ui/src/components/button.tsx`, `packages/ui/src/components/link.tsx`, `packages/ui/src/components/dialog.tsx`, `packages/ui/src/components/form-field.tsx`, `packages/ui/src/components/status.tsx`, `packages/ui/src/components/table.tsx`, `packages/ui/src/components/tabs.tsx`, `packages/ui/src/components/toast.tsx`, and `packages/ui/src/components/index.ts`
- [ ] T045 Create deterministic owner, publication, evidence, job, application, and provider fixture builders in `tests/fixtures/builders.ts` and `supabase/seed/acceptance.sql`

**Checkpoint**: Authentication, RLS, private storage, contracts, idempotent workflow dispatch, safe
telemetry, shared UI, and fixtures pass before story work begins.

---

## Phase 3: User Story 1 — Establish Trusted Career Knowledge (Priority: P1) 🎯 MVP

**Goal**: Let the owner create manual facts, ingest documents, review extracted facts, link evidence, and
control public eligibility from one canonical Career Brain. (FR-007–FR-027, ST-001–ST-002)

**Independent Test**: Starting with an empty seeded owner, create one manual experience, ingest one test
document, approve/edit/reject facts, keep one fact private, stage a public projection, and prove only the
approved public fact is eligible for publication.

### Tests for User Story 1 — write first and confirm expected failures

- [ ] T046 [P] [US1] Write database constraint and RLS tests for structured career records and owner isolation in `supabase/tests/010_career_records.test.sql`
- [ ] T047 [P] [US1] Write append-only fact-version, trust/review, evidence, visibility, and publication-eligibility tests in `supabase/tests/011_career_evidence.test.sql`
- [ ] T048 [P] [US1] Write HTTP contract tests for career facts, experiences, projects, achievements, skills, and reviews in `tests/contract/career-api.contract.test.ts`
- [ ] T049 [P] [US1] Write HTTP/event contract tests for Drive connection, upload, sync, ingestion status, cancellation, and fact review in `tests/contract/document-ingestion.contract.test.ts`
- [ ] T050 [P] [US1] Write integration tests for manual fact creation, correction, approval, visibility, and provenance in `tests/integration/career-fact-review.test.ts`
- [ ] T051 [P] [US1] Write integration tests for Drive cursor paging, webhook wake-up, reconciliation, unchanged hashes, revisions, removals, and permission loss in `tests/integration/drive-sync.test.ts`
- [ ] T052 [P] [US1] Write security tests for MIME mismatch, PDF resource exhaustion, DOCX zip bombs, hidden instructions, parser timeout, and quarantine in `apps/worker/tests/test_untrusted_documents.py`
- [ ] T053 [P] [US1] Write worker tests for PDF/DOCX/text parsing anchors, chunk hashes, extraction schemas, and idempotent embeddings in `apps/worker/tests/test_ingestion_pipeline.py`
- [ ] T054 [US1] Write the independent Career Brain browser journey from quickstart scenarios 2–3 in `tests/e2e/career-brain.spec.ts`

### Implementation for User Story 1

- [ ] T055 [US1] Create organizations, experiences, skills, projects, achievements, metrics, education, certifications, decisions, and leadership tables in `supabase/migrations/0010_career_records.sql`
- [ ] T056 [US1] Create career facts, immutable versions, review state, supersession, and contribution constraints in `supabase/migrations/0011_career_facts.sql`
- [ ] T057 [US1] Create evidence sources/versions/chunks, claim-evidence links, and provenance constraints in `supabase/migrations/0012_evidence.sql`
- [ ] T058 [US1] Create documents, document versions, ingestion runs/items, extracted facts, and review records in `supabase/migrations/0013_documents_ingestion.sql`
- [ ] T059 [US1] Create projection rules, staged/published snapshots, public items, and public evidence tables in `supabase/migrations/0014_portfolio_projection.sql`
- [ ] T060 [US1] Add career/evidence/document/projection RLS, append-only guards, GIN search index, vector extension, and indexes in `supabase/migrations/0015_career_security_indexes.sql`
- [ ] T061 [P] [US1] Implement TypeScript career, evidence, document, and projection repositories in `packages/database/src/repositories/career.ts`, `packages/database/src/repositories/evidence.ts`, `packages/database/src/repositories/documents.ts`, and `packages/database/src/repositories/projection.ts`
- [ ] T062 [P] [US1] Implement Python evidence/document/chunk repositories with owner and source-version checks in `apps/worker/src/career_worker/repositories/evidence.py`
- [ ] T063 [US1] Implement manual fact creation, immutable correction, structured entity linking, and archival in `packages/career/src/facts.ts`
- [ ] T064 [US1] Implement approve, edit-and-approve, reject, defer, trust, and visibility transition rules in `packages/career/src/review.ts`
- [ ] T065 [US1] Implement provenance validation, claim-evidence support classes, source availability, and conflict handling in `packages/knowledge/src/evidence.ts`
- [ ] T066 [US1] Implement projection preview validation and confirmed immutable publication/withdrawal in `packages/career/src/publication.ts`
- [ ] T067 [P] [US1] Implement Google Drive OAuth, start/change tokens, paged drain, channel renewal, exports, and content hashes in `packages/documents/src/google-drive.ts`
- [ ] T068 [US1] Implement verified Drive authorization/callback/webhook and connection revocation routes in `apps/web/app/api/v1/integrations/drive/authorize/route.ts`, `apps/web/app/api/v1/integrations/drive/callback/route.ts`, `apps/web/app/api/v1/integrations/drive/webhook/route.ts`, and `apps/web/app/api/v1/integrations/[id]/route.ts`
- [ ] T069 [US1] Implement Drive reconciliation and document-change durable workflows with transactional cursor/outbox semantics in `apps/web/inngest/drive-sync.ts`
- [ ] T070 [P] [US1] Implement bounded private upload creation, object metadata, and reprocess requests in `packages/documents/src/uploads.ts`
- [ ] T071 [US1] Implement file signature/size validation, quarantine, scanner hooks, and resource-limit policy in `apps/worker/src/career_worker/security/file_validation.py`
- [ ] T072 [US1] Implement isolated PDF, DOCX, Markdown/text parsers and bounded OCR fallback in `apps/worker/src/career_worker/parsing/parsers.py`
- [ ] T073 [US1] Implement normalization, page/section/offset mapping, chunking, and immutable content hashes in `apps/worker/src/career_worker/ingestion/chunking.py`
- [ ] T074 [US1] Implement schema-only career extraction with evidence spans and candidate-only persistence in `apps/worker/src/career_worker/extraction/career_facts.py`
- [ ] T075 [US1] Implement versioned embedding generation, compatible-dimension checks, and idempotent upserts in `apps/worker/src/career_worker/ingestion/embeddings.py`
- [ ] T076 [US1] Implement parsing, extraction, embedding, removal, retry, partial, and cancellation workflows in `apps/worker/src/career_worker/workflows/ingestion.py`
- [ ] T077 [US1] Implement owner career/document/review/projection APIs from the HTTP contract in `apps/web/app/api/v1/career/facts/route.ts`, `apps/web/app/api/v1/career/facts/[id]/route.ts`, `apps/web/app/api/v1/career/facts/[id]/review/route.ts`, `apps/web/app/api/v1/career/experiences/route.ts`, `apps/web/app/api/v1/career/experiences/[id]/route.ts`, `apps/web/app/api/v1/career/projects/route.ts`, `apps/web/app/api/v1/career/projects/[id]/route.ts`, `apps/web/app/api/v1/career/achievements/route.ts`, `apps/web/app/api/v1/career/skills/route.ts`, `apps/web/app/api/v1/career/evidence/[id]/route.ts`, `apps/web/app/api/v1/documents/route.ts`, `apps/web/app/api/v1/documents/uploads/route.ts`, `apps/web/app/api/v1/documents/sync-runs/route.ts`, `apps/web/app/api/v1/ingestion-runs/[id]/route.ts`, `apps/web/app/api/v1/ingestion-runs/[id]/cancel/route.ts`, `apps/web/app/api/v1/fact-reviews/route.ts`, `apps/web/app/api/v1/portfolio/projection/route.ts`, `apps/web/app/api/v1/portfolio/projection/[sourceType]/[sourceId]/route.ts`, `apps/web/app/api/v1/portfolio/previews/route.ts`, `apps/web/app/api/v1/portfolio/publications/route.ts`, and `apps/web/app/api/v1/portfolio/publications/[id]/withdraw/route.ts`
- [ ] T078 [P] [US1] Build Career Brain list/detail/edit and evidence-provenance UI in `apps/web/app/(dashboard)/career-brain/page.tsx` and `apps/web/components/dashboard/career-brain/index.tsx`
- [ ] T079 [US1] Build Documents, ingestion-run progress, fact-review queue, and projection-preview UI and make all US1 tests pass in `apps/web/app/(dashboard)/documents/page.tsx` and `apps/web/components/dashboard/fact-review/index.tsx`

**Checkpoint**: User Story 1 is independently deployable as a private trusted Career Brain MVP with a
staged publication boundary; it does not require the final public portfolio UI.

---

## Phase 4: User Story 2 — Understand the Career on One Public Page (Priority: P1)

**Goal**: Present positioning, career progression, projects, impact, skills, writing, and contact in one
accessible, fast scrolling experience backed only by the active publication. (FR-028–FR-038)

**Independent Test**: Seed one active publication, navigate every section and detail route on desktop and
mobile with keyboard/screen reader/reduced motion, then stop private services and verify content remains.

### Tests for User Story 2 — write first and confirm expected failures

- [ ] T080 [P] [US2] Write public portfolio/project/article/evidence contract tests that reject private fields in `tests/contract/public-portfolio.contract.test.ts`
- [ ] T081 [P] [US2] Write desktop/mobile one-page navigation and public detail-route tests in `tests/e2e/public-portfolio.spec.ts`
- [ ] T082 [P] [US2] Write keyboard, landmark, focus, contrast, screen-reader, and reduced-motion tests in `tests/accessibility/public-portfolio.a11y.spec.ts`
- [ ] T083 [P] [US2] Write public content timing, bundle, image, and timeline-scroll budgets in `tests/performance/public-portfolio.js`
- [ ] T084 [P] [US2] Write unit tests for publication-to-section view-model ordering and impact-first presentation in `packages/career/src/public-view.test.ts`

### Implementation for User Story 2

- [ ] T085 [US2] Implement active-publication repository and safe public evidence lookup in `packages/database/src/repositories/publication.ts`
- [ ] T086 [US2] Implement public portfolio, project, article, and evidence routes with publication-version caching in `apps/web/app/api/v1/public/portfolio/route.ts`, `apps/web/app/api/v1/public/projects/[slug]/route.ts`, `apps/web/app/api/v1/public/posts/[slug]/route.ts`, and `apps/web/app/api/v1/public/evidence/[id]/route.ts`
- [ ] T087 [US2] Compose the semantic single-page public route from active publication sections in `apps/web/app/(public)/page.tsx`
- [ ] T088 [P] [US2] Implement concise Hero and About sections with approved links/actions in `apps/web/components/portfolio/hero.tsx` and `apps/web/components/portfolio/about.tsx`
- [ ] T089 [US2] Implement desktop sticky career rail, active-stage observation, mobile vertical timeline, and reduced-motion fallback in `apps/web/components/portfolio/career-timeline.tsx`
- [ ] T090 [P] [US2] Implement approved Selected Projects and Measurable Impact sections with contextualized metrics in `apps/web/components/portfolio/projects.tsx` and `apps/web/components/portfolio/impact.tsx`
- [ ] T091 [P] [US2] Implement Skills, Writing preview, and owner-approved Contact sections in `apps/web/components/portfolio/skills.tsx`, `apps/web/components/portfolio/writing.tsx`, and `apps/web/components/portfolio/contact.tsx`
- [ ] T092 [P] [US2] Implement accessible Role Match and Ask My AI section shells with non-AI unavailable states in `apps/web/components/portfolio/match-shell.tsx` and `apps/web/components/portfolio/ask-shell.tsx`
- [ ] T093 [US2] Implement sticky anchor navigation, current-section state, skip link, and focus restoration in `apps/web/components/portfolio/navigation.tsx`
- [ ] T094 [P] [US2] Implement sanitized project case-study detail route in `apps/web/app/(public)/projects/[slug]/page.tsx`
- [ ] T095 [P] [US2] Implement published article detail shell from the active snapshot in `apps/web/app/(public)/blog/[slug]/page.tsx`
- [ ] T096 [US2] Implement metadata, structured data, canonical URLs, sitemap, and safe social cards in `apps/web/app/(public)/metadata.ts` and `apps/web/app/sitemap.ts`
- [ ] T097 [US2] Implement publication cache tags and publish/withdraw invalidation in `apps/web/lib/publication-cache.ts`
- [ ] T098 [US2] Verify graceful degradation with worker/AI/integrations stopped and make all US2 tests pass in `tests/integration/public-degradation.test.ts`

**Checkpoint**: User Story 2 is a complete public portfolio using seeded or US1-produced publication data.

---

## Phase 5: User Story 3 — Ask Evidence-Backed Questions and Assess Role Fit (Priority: P1)

**Goal**: Answer public career questions and score pasted JDs using only approved public evidence,
deterministic citations, and per-requirement scoring. (FR-039–FR-050, AIR-001–AIR-008)

**Independent Test**: With a controlled public evidence snapshot, ask supported, transferable,
unsupported, conflicting, private-targeting, and injected questions; then score a multi-requirement JD and
reproduce the result exactly.

### Tests for User Story 3 — write first and confirm expected failures

- [ ] T099 [P] [US3] Write lexical/vector candidate, RRF, reranker fallback, metadata filter, and exact-recall unit tests in `packages/knowledge/src/retrieval.test.ts`
- [ ] T100 [P] [US3] Write database tests proving public retrieval excludes private/restricted/deleted chunks before ranking in `supabase/tests/020_public_retrieval_rls.test.sql`
- [ ] T101 [P] [US3] Write cross-provider contract fixtures for structured output, streams, refusal, timeout, usage, and downgrade in `tests/contract/ai-provider.contract.test.ts`
- [ ] T102 [P] [US3] Write chat SSE, evidence-handle, citation, abstention, and safe-error contract tests in `tests/contract/public-chat.contract.test.ts`
- [ ] T103 [P] [US3] Write deterministic requirement classification value, weight, decimal score, and formula-version tests in `packages/jobs/src/jd-score.test.ts`
- [ ] T104 [P] [US3] Write JD extraction, per-requirement retrieval, explanation immutability, and hostile-JD contract tests in `tests/contract/public-jd-match.contract.test.ts`
- [ ] T105 [P] [US3] Create labeled grounding, citation, abstention, conflict, privacy, and prompt-injection evaluation cases in `tests/evals/public-intelligence/cases.jsonl`
- [ ] T106 [US3] Write the public chat and recruiter matcher browser journey from quickstart scenarios 5–6 in `tests/e2e/public-intelligence.spec.ts`

### Implementation for User Story 3

- [ ] T107 [P] [US3] Create AI provider/model/per-task configs, immutable prompts, agent/retrieval/generation runs, candidates, contexts, claims, citations, and evaluation tables in `supabase/migrations/0020_ai_retrieval.sql`
- [ ] T108 [US3] Apply private run-data RLS, append-only prompt/version rules, and retrieval indexes in `supabase/migrations/0021_ai_retrieval_security.sql`
- [ ] T109 [P] [US3] Implement authorization-filtered structured and weighted PostgreSQL full-text candidate retrieval in `packages/knowledge/src/lexical-retrieval.ts`
- [ ] T110 [P] [US3] Implement exact cosine retrieval with per-model compatibility and measured HNSW switching in `packages/knowledge/src/vector-retrieval.ts`
- [ ] T111 [US3] Implement bounded candidate union, RRF fusion, optional reranking, fallback, and rank telemetry in `packages/knowledge/src/hybrid-retrieval.ts`
- [ ] T112 [US3] Implement immutable opaque evidence handles and public citation projection in `packages/knowledge/src/evidence-handles.ts`
- [ ] T113 [US3] Implement deterministic claim, handle, source-version, offset, visibility, and abstention validation in `packages/ai/src/claim-verifier.ts`
- [ ] T114 [P] [US3] Implement the first approved text/structured/streaming provider adapter and capability contract in `packages/ai/src/providers/primary.ts`
- [ ] T115 [P] [US3] Implement immutable prompt registry, alias resolution, content hashes, and output-schema validation in `packages/ai/src/prompts.ts`
- [ ] T116 [US3] Implement the no-tool public portfolio-chat workflow with public-only retrieval and verified claims in `packages/ai/src/workflows/public-chat.ts`
- [ ] T117 [US3] Implement rate-limited reconnectable public chat SSE endpoint in `apps/web/app/api/v1/public/chat/route.ts`
- [ ] T118 [US3] Implement accessible streaming answer, citations, limitations, retry, and no-evidence UI in `apps/web/components/portfolio/ask-my-ai.tsx`
- [ ] T119 [US3] Implement schema-versioned JD requirement extraction and normalization in `packages/jobs/src/jd-analysis.ts`
- [ ] T120 [US3] Implement one authorized evidence retrieval and match classification per meaningful requirement in `packages/jobs/src/requirement-matcher.ts`
- [ ] T121 [US3] Implement immutable deterministic JD match scoring and explanation input snapshot in `packages/jobs/src/jd-score.ts`
- [ ] T122 [US3] Implement public JD match endpoint with input limits, hostile-content treatment, and safe results in `apps/web/app/api/v1/public/jd-matches/route.ts`
- [ ] T123 [US3] Implement accessible requirement table, citations, score explanation, and limitations UI in `apps/web/components/portfolio/jd-matcher.tsx`
- [ ] T124 [US3] Implement public AI abuse controls, evaluation runner, release thresholds, and make all US3 tests pass in `tests/evals/public-intelligence/run.ts` and `apps/web/lib/public-ai-rate-limit.ts`

**Checkpoint**: User Story 3 is independently testable against a seeded publication and cannot access
private Career Brain data.

---

## Phase 6: User Story 4 — Discover, Compare, and Track Opportunities (Priority: P2)

**Goal**: Configure lawful sources and profiles, run/schedule searches, add jobs manually, deduplicate,
score, and track lifecycle history. (FR-051–FR-068, ST-003)

**Independent Test**: Configure two fake sources and one profile, ingest duplicate and distinct jobs plus a
manual JD, fail one source, reproduce scores, and transition one job with full history.

### Tests for User Story 4 — write first and confirm expected failures

- [ ] T125 [P] [US4] Write job source/profile/run/job/requirement/score/history RLS and constraint tests in `supabase/tests/030_jobs.test.sql`
- [ ] T126 [P] [US4] Write adapter capability, connection, pagination, mapping, rate-limit, unsafe-response, and health contract tests in `tests/contract/job-source-adapter.contract.test.ts`
- [ ] T127 [P] [US4] Write normalization, exact-source, canonical-URL, fingerprint, similarity, ambiguous-merge, and reversal unit tests in `packages/jobs/src/deduplication.test.ts`
- [ ] T128 [P] [US4] Write career/opportunity score, configured weights, job state-machine, and append-only history tests in `packages/jobs/src/scoring-state.test.ts`
- [ ] T129 [P] [US4] Write search fan-out, pagination checkpoint, retry, duplicate-event, source-failure, and partial-run tests in `tests/integration/job-search-workflow.test.ts`
- [ ] T130 [P] [US4] Write owner job-source/profile/run/job/status HTTP contract tests in `tests/contract/jobs-api.contract.test.ts`
- [ ] T131 [US4] Write the discovery/manual/deduplication/list/Kanban browser journey from quickstart scenario 7 in `tests/e2e/jobs.spec.ts`

### Implementation for User Story 4

- [ ] T132 [US4] Create job sources/configs, search profiles/schedules, search runs, and source-run tables in `supabase/migrations/0030_job_sources_search.sql`
- [ ] T133 [US4] Create canonical jobs, immutable JD versions, and source-reference tables in `supabase/migrations/0031_jobs.sql`
- [ ] T134 [US4] Create requirements, requirement matches, score snapshots, job history, transition guards, RLS, and indexes in `supabase/migrations/0032_job_analysis_security.sql`
- [ ] T135 [US4] Implement the versioned job-source adapter registry and capability validation in `packages/jobs/src/adapters/registry.ts`
- [ ] T136 [US4] Implement secret-reference source configuration, declarative mapping, connection test, and safe removal in `packages/jobs/src/sources.ts`
- [ ] T137 [P] [US4] Implement the Greenhouse job-source adapter in `packages/jobs/src/adapters/greenhouse.ts`
- [ ] T138 [P] [US4] Implement the Lever job-source adapter in `packages/jobs/src/adapters/lever.ts`
- [ ] T139 [P] [US4] Implement the Ashby job-source adapter in `packages/jobs/src/adapters/ashby.ts`
- [ ] T140 [P] [US4] Implement the RSS job-source adapter with safe XML parsing in `packages/jobs/src/adapters/rss.ts`
- [ ] T141 [US4] Implement validated custom REST mappings through the shared safe-fetch boundary with additional adapter rate/size controls and no executable code in `packages/jobs/src/adapters/custom-rest.ts`
- [ ] T142 [P] [US4] Implement manual, recruiter, referral, and other job entry with JD-only minimum in `packages/jobs/src/manual-job.ts`
- [ ] T143 [US4] Implement canonical job normalization, field warnings, source payload references, and JD versioning in `packages/jobs/src/normalization.ts`
- [ ] T144 [US4] Implement deterministic deduplication, source-reference retention, ambiguous review, and reversible merge in `packages/jobs/src/deduplication.ts`
- [ ] T145 [US4] Reuse private JD extraction and per-requirement Career Brain retrieval for job analysis in `packages/jobs/src/private-job-analysis.ts`
- [ ] T146 [P] [US4] Implement evidence-backed Career Match calculation snapshots in `packages/jobs/src/career-match.ts`
- [ ] T147 [P] [US4] Implement configurable Opportunity Score factor/weight/version snapshots in `packages/jobs/src/opportunity-score.ts`
- [ ] T148 [US4] Implement validated job lifecycle transitions and append-only history in `packages/jobs/src/job-state.ts`
- [ ] T149 [US4] Implement scheduled/manual source fan-out, throttling, pagination, partial success, notifications, and idempotency in `apps/web/inngest/job-search.ts`
- [ ] T150 [US4] Implement job endpoints in `apps/web/app/api/v1/job-sources/route.ts`, `apps/web/app/api/v1/job-sources/[id]/route.ts`, `apps/web/app/api/v1/job-sources/[id]/tests/route.ts`, `apps/web/app/api/v1/search-profiles/route.ts`, `apps/web/app/api/v1/search-profiles/[id]/route.ts`, `apps/web/app/api/v1/job-search-runs/route.ts`, `apps/web/app/api/v1/job-search-runs/[id]/route.ts`, `apps/web/app/api/v1/jobs/route.ts`, `apps/web/app/api/v1/jobs/[id]/route.ts`, `apps/web/app/api/v1/jobs/[id]/transitions/route.ts`, and `apps/web/app/api/v1/jobs/[id]/analysis/route.ts`
- [ ] T151 [P] [US4] Build source configuration, safe secret entry, connection tests, and health UI in `apps/web/app/(dashboard)/settings/job-sources/page.tsx`
- [ ] T152 [P] [US4] Build search profile criteria, scoring weights, schedules, and run-history UI in `apps/web/app/(dashboard)/settings/search-profiles/page.tsx`
- [ ] T153 [US4] Build filterable job list, Kanban, canonical detail, source references, score factors, and transition UI and make all US4 tests pass in `apps/web/app/(dashboard)/jobs/page.tsx` and `apps/web/components/dashboard/jobs/index.tsx`

**Checkpoint**: User Story 4 works with seeded Career Brain evidence and fake or configured sources; one
source failure cannot discard other results.

---

## Phase 7: User Story 5 — Prepare and Preserve an Application Package (Priority: P2)

**Goal**: Analyze applications, prepare safe form answers, version tailored CVs/letters, research
compensation, and preserve exact final/submitted snapshots without submitting externally. (FR-069–FR-092,
ST-004)

**Independent Test**: For a seeded job/application, paste questions, populate deterministic fields,
generate/edit/version answer/CV/letter/compensation artifacts, assemble a package, and prove no external
submission occurs.

### Tests for User Story 5 — write first and confirm expected failures

- [ ] T154 [P] [US5] Write application/form/answer/package/artifact/compensation RLS, version, and immutability tests in `supabase/tests/040_applications_artifacts.test.sql`
- [ ] T155 [P] [US5] Write form field extraction, limits, deterministic profile fill, conditional fields, and demographic manual-only tests in `packages/applications/src/forms.test.ts`
- [ ] T156 [P] [US5] Write answer grounding, saved-answer adaptation, stale-company removal, owner edit, and limit tests in `packages/applications/src/answers.test.ts`
- [ ] T157 [P] [US5] Write ResumeData/LetterData schema, evidence coverage, forbidden markup/layout, and two-to-four connection tests in `packages/applications/src/artifact-schemas.test.ts`
- [ ] T158 [P] [US5] Write deterministic PDF/DOCX rendering, template/font/version, binary hash, and immutable-final fixture tests in `tests/integration/artifact-rendering.test.ts`
- [ ] T159 [P] [US5] Write compensation tiering, normalization, currency/period, strategy, confidence, and insufficient-evidence tests in `packages/compensation/src/recommendation.test.ts`
- [ ] T160 [P] [US5] Write application/form/answer/artifact/package/compensation HTTP contract tests in `tests/contract/applications-api.contract.test.ts`
- [ ] T161 [US5] Write the application-package browser journey and network assertion forbidding submission from quickstart scenario 8 in `tests/e2e/application-package.spec.ts`

### Implementation for User Story 5

- [ ] T162 [US5] Create applications, status history, forms, fields, answer versions, saved answers, and owner-uploaded/linked application documents with provenance and private object references in `supabase/migrations/0040_applications.sql`
- [ ] T163 [US5] Create generated artifacts/versions/evidence, packages/items, immutable final guards, RLS, and indexes in `supabase/migrations/0041_artifacts.sql`
- [ ] T164 [US5] Create compensation research/source/benchmark/recommendation tables, RLS, and indexes in `supabase/migrations/0042_compensation.sql`
- [ ] T165 [US5] Implement application workspace creation, lifecycle, readiness, timeline, current-JD binding, and owner-uploaded/linked document versioning/removal in `packages/applications/src/application-service.ts` and `packages/applications/src/documents.ts`
- [ ] T166 [US5] Implement paste/manual accessible-form capture and optional field analysis through the shared safe-fetch boundary in `packages/applications/src/forms.ts`
- [ ] T167 [P] [US5] Implement deterministic private application-profile field population in `packages/applications/src/profile-fill.ts`
- [ ] T168 [P] [US5] Implement saved-answer versioning, search, context stripping, and current-evidence revalidation in `packages/applications/src/saved-answers.ts`
- [ ] T169 [US5] Implement evidence-backed answer drafting, schema/length validation, owner review, and immutable versions in `packages/applications/src/answers.ts`
- [ ] T170 [P] [US5] Implement achievement ranking and schema-constrained ResumeData composition in `packages/applications/src/resume-composer.ts`
- [ ] T171 [P] [US5] Implement two-to-four evidence connection selection and LetterData composition in `packages/applications/src/letter-composer.ts`
- [ ] T172 [US5] Implement material-claim evidence coverage and artifact finalization validation in `packages/applications/src/artifact-evidence.ts`
- [ ] T173 [P] [US5] Implement versioned Modern, Minimal, Technical, German, and Executive template registry in `packages/applications/src/templates/registry.ts`
- [ ] T174 [P] [US5] Implement sandboxed deterministic HTML/CSS-to-PDF rendering in `packages/applications/src/renderers/pdf.ts`
- [ ] T175 [P] [US5] Implement deterministic structured-content-to-DOCX rendering in `packages/applications/src/renderers/docx.ts`
- [ ] T176 [US5] Implement artifact versioning, private storage, owner review/final/submitted snapshot, and package manifests in `packages/applications/src/artifacts.ts`
- [ ] T177 [US5] Implement lawful compensation source capture, tiered benchmarks, deterministic floor/target/stretch, and historical results in `packages/compensation/src/research.ts`
- [ ] T178 [US5] Implement application endpoints without any submission route in `apps/web/app/api/v1/jobs/[id]/applications/route.ts`, `apps/web/app/api/v1/applications/[id]/route.ts`, `apps/web/app/api/v1/applications/[id]/transitions/route.ts`, `apps/web/app/api/v1/applications/[id]/forms/route.ts`, `apps/web/app/api/v1/applications/[id]/documents/route.ts`, `apps/web/app/api/v1/applications/[id]/documents/[documentId]/route.ts`, `apps/web/app/api/v1/application-fields/[id]/answer-drafts/route.ts`, `apps/web/app/api/v1/applications/[id]/artifacts/route.ts`, `apps/web/app/api/v1/artifacts/[id]/versions/route.ts`, `apps/web/app/api/v1/artifact-versions/[id]/review/route.ts`, `apps/web/app/api/v1/artifact-versions/[id]/submitted-snapshot/route.ts`, `apps/web/app/api/v1/applications/[id]/packages/route.ts`, `apps/web/app/api/v1/applications/[id]/compensation-research/route.ts`, and `apps/web/app/api/v1/compensation-research/[id]/route.ts`
- [ ] T179 [P] [US5] Build application workspace overview, JD match, readiness, form, private uploaded/linked documents, timeline, and notes UI in `apps/web/app/(dashboard)/applications/[id]/page.tsx` and `apps/web/components/dashboard/applications/documents.tsx`
- [ ] T180 [US5] Build answer/CV/letter editors, evidence coverage, version picker, package manifest, compensation view, and make all US5 tests pass in `apps/web/components/dashboard/applications/index.tsx`

**Checkpoint**: User Story 5 produces exact owner-reviewed packages and records submitted snapshots but has
no capability to apply, fill a live form, send a message, or submit salary expectations.

---

## Phase 8: User Story 6 — Prepare for and Learn from Interviews (Priority: P2)

**Goal**: Track arbitrary evidence-based/manual stages, generate personalized kits and stories, practice
privately, preserve original notes, and derive reviewable learning. (FR-093–FR-108, ST-005)

**Independent Test**: Seed an application, infer one supported stage, add/reorder one manual stage,
generate a kit and confidence-banded questions, complete a mock session, add notes, and prove journal bytes
are unchanged after insight generation.

### Tests for User Story 6 — write first and confirm expected failures

- [ ] T181 [P] [US6] Write journal/interview/process/stage/story/mock/feedback RLS, append-only, and integrity tests in `supabase/tests/050_interviews_journal.test.sql`
- [ ] T182 [P] [US6] Write arbitrary stage ordering, evidence-source priority, unknown process, and transition-history tests in `packages/interviews/src/stages.test.ts`
- [ ] T183 [P] [US6] Write preparation-kit personalization, evidence coverage, gaps, company research, and prior-learning tests in `packages/interviews/src/preparation-kit.test.ts`
- [ ] T184 [P] [US6] Write question probability-band, non-guarantee, question-to-story, and contribution-attribution tests in `packages/interviews/src/questions-stories.test.ts`
- [ ] T185 [P] [US6] Write mock qualitative-feedback and original-journal hash integrity tests in `packages/interviews/src/mock-journal.test.ts`
- [ ] T186 [P] [US6] Write journal/interview/stage/kit/story/mock HTTP contract tests and assert no live-assistance routes in `tests/contract/interviews-api.contract.test.ts`
- [ ] T187 [US6] Write the interview preparation and journal-integrity browser journey from quickstart scenario 9 in `tests/e2e/interview-preparation.spec.ts`

### Implementation for User Story 6

- [ ] T188 [US6] Create journal/version/tag/insight and interview process/stage/history/question/topic/kit/story/mock/feedback tables with RLS in `supabase/migrations/0050_interviews_journal.sql`
- [ ] T189 [P] [US6] Implement journal and interview repositories with immutable original/version semantics in `packages/database/src/repositories/interviews.ts` and `packages/database/src/repositories/journal.ts`
- [ ] T190 [US6] Implement owner-authored journal versions, private attachments, tags, and separate derived insights in `packages/interviews/src/journal.ts`
- [ ] T191 [US6] Implement interview-process proposal using JD, public company, owner recruiter info, history, then manual priority in `packages/interviews/src/process-inference.ts`
- [ ] T192 [US6] Implement arbitrary stage create/reorder/schedule/complete/cancel/skip transitions and append-only history in `packages/interviews/src/stages.ts`
- [ ] T193 [P] [US6] Define versioned preparation-kit, predicted-question, story-match, and feedback schemas/prompts in `packages/interviews/src/schemas.ts` and `packages/ai/src/prompts/interviews.ts`
- [ ] T194 [US6] Implement stage-specific kit orchestration across JD, company snapshot, Career Brain, gaps, and prior learning in `packages/interviews/src/preparation-kit.ts`
- [ ] T195 [P] [US6] Implement confidence-banded question prediction with evidence rationale and guaranteed-language rejection in `packages/interviews/src/questions.ts`
- [ ] T196 [P] [US6] Implement evidence-backed STAR story library and question-to-story ranking in `packages/interviews/src/star-stories.ts`
- [ ] T197 [US6] Implement private recruiter/technical/system-design/behavioral/manager/leadership mock sessions and qualitative feedback in `packages/interviews/src/mock-interview.ts`
- [ ] T198 [US6] Implement post-interview note capture and separately reviewable topic/strength/gap extraction in `packages/interviews/src/post-interview.ts`
- [ ] T199 [US6] Implement interview frequency, conversion, assessment, strength, and gap source summaries for later analytics in `packages/interviews/src/insight-summaries.ts`
- [ ] T200 [P] [US6] Implement journal endpoints in `apps/web/app/api/v1/journal-entries/route.ts` and `apps/web/app/api/v1/journal-entries/[id]/insight-runs/route.ts`
- [ ] T201 [US6] Implement interview endpoints in `apps/web/app/api/v1/applications/[id]/interview-process/route.ts`, `apps/web/app/api/v1/interview-processes/[id]/stages/route.ts`, `apps/web/app/api/v1/interview-stages/[id]/transitions/route.ts`, `apps/web/app/api/v1/interview-stages/[id]/preparation-kits/route.ts`, `apps/web/app/api/v1/star-stories/route.ts`, `apps/web/app/api/v1/interview-stages/[id]/mock-interviews/route.ts`, and `apps/web/app/api/v1/mock-interviews/[id]/complete/route.ts`
- [ ] T202 [P] [US6] Build process timeline, evidence/unknown state, arbitrary stage editor, schedule, and outcome UI in `apps/web/app/(dashboard)/interviews/[id]/page.tsx`
- [ ] T203 [P] [US6] Build kit, likely-question bands, evidence maps, STAR stories, and interviewer-question UI in `apps/web/components/dashboard/interviews/preparation-kit.tsx`
- [ ] T204 [US6] Build private mock practice, qualitative feedback, journal, post-interview notes, and insight review UI in `apps/web/components/dashboard/interviews/mock-and-journal.tsx`
- [ ] T205 [US6] Add a route/tool allowlist assertion forbidding meeting join, live transcription, hidden help, and live answers and make all US6 tests pass in `tests/security/no-live-interview-assistance.test.ts`

**Checkpoint**: User Story 6 supports preparation and learning only; unknown stages stay unknown and no live
employer-interview participation exists.

---

## Phase 9: User Story 7 — Publish Evidence-Safe Technical Writing (Priority: P3)

**Goal**: Draft, assist, schedule, publish, archive, and version technical writing while keeping articles
distinct from proof of professional experience. (FR-109–FR-113, ST-006)

**Independent Test**: Draft an assisted career-based article, verify evidence retrieval, require explicit
publish approval, expose the published detail, archive it, and prove the article alone cannot support an
employment claim.

### Tests for User Story 7 — write first and confirm expected failures

- [ ] T206 [P] [US7] Write post/version/tag/state/publication approval, append-only, slug, and RLS tests in `supabase/tests/060_blog.test.sql`
- [ ] T207 [P] [US7] Write career-based drafting evidence, unsupported-story rejection, and technical-knowledge classification tests in `packages/career/src/article-evidence.test.ts`
- [ ] T208 [P] [US7] Write post draft/edit/schedule/publish/archive and public article HTTP contract tests in `tests/contract/blog-api.contract.test.ts`
- [ ] T209 [US7] Write the assisted draft, explicit publish, public detail, knowledge classification, and archive browser journey in `tests/e2e/blog.spec.ts`

### Implementation for User Story 7

- [ ] T210 [US7] Create posts, immutable versions, tags, state guards, publication approvals, RLS, and indexes in `supabase/migrations/0060_blog.sql`
- [ ] T211 [US7] Implement draft/version/slug/schedule/publish/archive state and repository services in `packages/career/src/posts.ts`
- [ ] T212 [P] [US7] Define evidence-safe topic/outline/draft/rewrite/summary/title/tag/search-assistance schemas and prompts in `packages/ai/src/prompts/blog.ts`
- [ ] T213 [US7] Implement private writing-assistance orchestration with Career Brain retrieval before career-based drafting in `packages/ai/src/workflows/blog-assistant.ts`
- [ ] T214 [US7] Implement article claim-evidence validation and technical-knowledge-not-career-proof classification in `packages/career/src/article-evidence.ts`
- [ ] T215 [US7] Implement content endpoints with confirmation in `apps/web/app/api/v1/posts/route.ts`, `apps/web/app/api/v1/posts/[id]/route.ts`, `apps/web/app/api/v1/posts/[id]/schedule/route.ts`, `apps/web/app/api/v1/posts/[id]/publish/route.ts`, and `apps/web/app/api/v1/posts/[id]/archive/route.ts`
- [ ] T216 [P] [US7] Build private post list, filters, status, versions, and schedule UI in `apps/web/app/(dashboard)/blog/page.tsx`
- [ ] T217 [P] [US7] Build accessible Markdown/MDX editor, preview, evidence panel, and assistance controls in `apps/web/components/dashboard/blog/editor.tsx`
- [ ] T218 [US7] Integrate confirmed post publishing/archiving with immutable portfolio snapshots and cache invalidation in `packages/career/src/post-publication.ts`
- [ ] T219 [US7] Complete public article rendering, metadata, tags, citations, and archive behavior in `apps/web/app/(public)/blog/[slug]/page.tsx`
- [ ] T220 [US7] Index published technical knowledge under a non-career-proof evidence type and make all US7 tests pass in `packages/knowledge/src/article-indexing.ts`

**Checkpoint**: User Story 7 publishes only owner-approved immutable versions and never upgrades technical
writing into professional-experience evidence by itself.

---

## Phase 10: User Story 8 — Review Career and Search Analytics (Priority: P3)

**Goal**: Provide private, privacy-conscious engagement, funnel, interview, and evidence-gap analytics
without invasive tracking or unsupported skill conclusions. (FR-114–FR-119)

**Independent Test**: Load fixture events and lifecycle history, reproduce aggregates and filters, enforce
privacy thresholds, and verify undocumented skills are labeled as missing evidence rather than absent.

### Tests for User Story 8 — write first and confirm expected failures

- [ ] T221 [P] [US8] Write analytics session/event/aggregate RLS, retention, event-name/property allowlist, and no-free-text tests in `supabase/tests/070_analytics.test.sql`
- [ ] T222 [P] [US8] Write deterministic daily aggregate rebuild, late-event, idempotency, and calculation-version tests in `packages/analytics/src/aggregation.test.ts`
- [ ] T223 [P] [US8] Write application funnel counts, conversion, time-to-stage, role/country/source/work-model/score/salary filter tests in `packages/analytics/src/application-funnel.test.ts`
- [ ] T224 [P] [US8] Write interview pattern and career-gap tests distinguishing undocumented evidence from absent skill in `packages/analytics/src/career-gap.test.ts`
- [ ] T225 [P] [US8] Write consent, pseudonym, low-volume threshold, URL/query stripping, and sensitive-property rejection tests in `tests/security/analytics-privacy.test.ts`
- [ ] T226 [US8] Write the portfolio/funnel/interview/gap analytics browser journey from quickstart scenario 10 in `tests/e2e/analytics.spec.ts`

### Implementation for User Story 8

- [ ] T227 [US8] Create analytics sessions/events/daily metrics, retention fields, RLS, indexes, and allowed event constraints in `supabase/migrations/0070_analytics.sql`
- [ ] T228 [US8] Implement versioned public/private analytics event schemas with explicit property allowlists in `packages/analytics/src/events.ts`
- [ ] T229 [US8] Implement consent-aware, rate-limited public event ingestion and instrument allowlisted page/section engagement, project/article views, AI conversations, JD analyses, skill queries, and project interest without arbitrary/private text in `apps/web/app/api/v1/public/analytics/events/route.ts`, `apps/web/components/analytics/public-events.tsx`, `apps/web/components/portfolio/career-timeline.tsx`, `apps/web/components/portfolio/ask-my-ai.tsx`, and `apps/web/components/portfolio/jd-match.tsx`
- [ ] T230 [P] [US8] Implement PostHog consent adapter with sensitive dashboard replay disabled and maximum public masking in `packages/analytics/src/posthog-consent.ts`
- [ ] T231 [US8] Implement idempotent daily lifecycle/event aggregation and backfill workflow in `apps/web/inngest/analytics-aggregation.ts`
- [ ] T232 [P] [US8] Implement private portfolio engagement queries and minimum-cohort suppression in `packages/analytics/src/portfolio-analytics.ts`
- [ ] T233 [P] [US8] Implement reproducible application funnel and time-through-stage calculations/filters in `packages/analytics/src/application-funnel.ts`
- [ ] T234 [P] [US8] Implement interview technology/topic/theme/strength/gap/conversion summaries from reviewed data in `packages/analytics/src/interview-analytics.ts`
- [ ] T235 [US8] Implement market-demand versus Career Brain evidence comparison with documented-evidence status in `packages/analytics/src/career-gap.ts`
- [ ] T236 [US8] Implement separate document, demonstrate, write, and learn gap recommendations without unsupported skill claims in `packages/analytics/src/gap-recommendations.ts`
- [ ] T237 [US8] Implement private analytics endpoints with allowlisted filters in `apps/web/app/api/v1/analytics/portfolio/route.ts`, `apps/web/app/api/v1/analytics/applications/route.ts`, `apps/web/app/api/v1/analytics/interviews/route.ts`, and `apps/web/app/api/v1/analytics/career-gaps/route.ts`
- [ ] T238 [US8] Implement and build the `/dashboard` actionable summary with authorized deep links plus detailed accessible analytics charts, table equivalents, filters, confidence, and low-data caveats in `apps/web/app/api/v1/dashboard/route.ts`, `apps/web/app/(dashboard)/dashboard/page.tsx`, and `apps/web/app/(dashboard)/analytics/page.tsx`
- [ ] T239 [US8] Verify aggregates against source records within SC-021 tolerance and make all US8 tests pass in `tests/integration/analytics-reconciliation.test.ts`

**Checkpoint**: User Story 8 is private, reproducible, privacy-thresholded, and explicit about evidence
absence versus skill absence.

---

## Phase 11: User Story 9 — Operate Automations Safely (Priority: P3)

**Goal**: Let the owner inspect, control, retry, cancel, and troubleshoot bounded automations while
preserving unaffected services during provider/worker failures. (FR-120–FR-126, ST-007)

**Independent Test**: Trigger successful, partial, failed/retried, cancelled, duplicate, and worker-restart
runs; inspect every step and prove no automation can perform a consequential action.

### Tests for User Story 9 — write first and confirm expected failures

- [ ] T240 [P] [US9] Write schedule/run/step/notification/idempotency RLS, logical-key uniqueness, and state-transition tests in `supabase/tests/080_automation.test.sql`
- [ ] T241 [P] [US9] Write event envelope/version, unknown-major dead-letter, resource-owner mismatch, payload-size, and content-exclusion tests in `tests/contract/workflow-events.contract.test.ts`
- [ ] T242 [P] [US9] Write cooperative cancellation, active-step timeout, retry classification, and terminal-state tests in `tests/integration/workflow-cancellation.test.ts`
- [ ] T243 [P] [US9] Write worker restart, duplicate delivery, provider outage, circuit breaker, partial result, and graceful-degradation tests in `tests/integration/workflow-resilience.test.ts`
- [ ] T244 [P] [US9] Write workflow/AI trace allowlist and app-owned run-history retention tests in `tests/security/workflow-observability.test.ts`
- [ ] T245 [US9] Write the automation run inspection, cancellation, disablement, and failure browser journey from quickstart scenario 11 in `tests/e2e/automations.spec.ts`

### Implementation for User Story 9

- [ ] T246 [US9] Create automation schedules, notifications, expanded run/step state, dead letters, RLS, and indexes in `supabase/migrations/0080_automation.sql`
- [ ] T247 [US9] Implement the central bounded task classifier/coordinator with an allowlisted workflow registry in `packages/ai/src/orchestrator.ts`
- [ ] T248 [US9] Implement timezone/logical-date/jitter schedule creation, enablement, disablement, and overlap guards in `packages/analytics/src/schedules.ts`
- [ ] T249 [US9] Implement retry classification, cooperative cancellation, resume, dead-letter, and manual retry services in `packages/observability/src/workflow-control.ts`
- [ ] T250 [P] [US9] Implement provider health, concurrency, throttle, circuit-breaker, and safe diagnostic state in `packages/observability/src/provider-health.ts`
- [ ] T251 [P] [US9] Implement app-owned run/step search by correlation/resource with sanitized details in `packages/database/src/repositories/automation.ts`
- [ ] T252 [US9] Implement informational notification deduplication/preferences without consequential actions in `packages/analytics/src/notifications.ts`
- [ ] T253 [US9] Implement automation and AI configuration endpoints in `apps/web/app/api/v1/automations/route.ts`, `apps/web/app/api/v1/automations/[id]/route.ts`, `apps/web/app/api/v1/automation-runs/[id]/route.ts`, `apps/web/app/api/v1/automation-runs/[id]/cancel/route.ts`, `apps/web/app/api/v1/automation-runs/[id]/retry/route.ts`, `apps/web/app/api/v1/settings/ai-capabilities/route.ts`, and `apps/web/app/api/v1/settings/ai-capabilities/[taskType]/route.ts`
- [ ] T254 [P] [US9] Build automation list, safe purpose selector, timezone schedule, enable/disable, and next-run UI in `apps/web/app/(dashboard)/settings/automations/page.tsx`
- [ ] T255 [P] [US9] Build run detail, step timeline, attempts, partial results, retry/cancel eligibility, and sanitized error UI in `apps/web/app/(dashboard)/automations/[id]/page.tsx`
- [ ] T256 [P] [US9] Build authenticated per-task AI provider/model/creativity/length/timeout/retry/fallback settings with capability validation plus provider connection/health/circuit status without secret exposure in `apps/web/app/(dashboard)/settings/providers/page.tsx` and `apps/web/components/dashboard/settings/ai-capability-form.tsx`
- [ ] T257 [US9] Add deterministic failure-injection providers for timeout, 429, 5xx, malformed output, and worker loss in `tests/fixtures/providers/failure-injection.ts`
- [ ] T258 [US9] Enforce the automation purpose/tool denylist for publish, submit, send, approve, evidence change, and live interview actions and make all US9 tests pass in `packages/auth/src/automation-policy.ts`

**Checkpoint**: User Story 9 exposes trustworthy run control and recovery without expanding automation
authority.

---

## Phase 12: Polish & Cross-Cutting Release Gates

**Purpose**: Validate the complete selected release across requirements, privacy, security, AI quality,
accessibility, performance, portability, recovery, and deployment.

- [ ] T259 [P] Generate the final requirement-to-task-to-test traceability report in `specs/001-ai-career-os/traceability.md`
- [ ] T260 Run every quickstart scenario and the MP-006 visitor/owner usability protocol with exact revision/configuration hashes, task scripts, participant/run counts, timing, assistance, errors, first-attempt completion, and trust/control results in `specs/001-ai-career-os/validation/quickstart-results.md` and `specs/001-ai-career-os/validation/usability.md`
- [ ] T261 [P] Run the full extraction/retrieval/grounding/citation/abstention/JD/artifact/interview AI evaluation suite plus the MP-007 100-document ingestion corpus and record gates in `specs/001-ai-career-os/validation/ai-evaluation.md` and `specs/001-ai-career-os/validation/document-corpus.md`
- [ ] T262 [P] Run the full RLS/auth/SSRF/upload/prompt-injection/XSS/CSRF/tool-policy/secret-leak security suite and record findings in `specs/001-ai-career-os/validation/security-review.md`
- [ ] T263 [P] Run and report MP-001–MP-004 public content, owner acknowledgement, AI stream-start, retrieval, job fan-out, complete corpus scale, and analytics performance profiles in `tests/performance/release.js` and `specs/001-ai-career-os/validation/performance.md`
- [ ] T264 [P] Run WCAG 2.1 AA manual/automated checks and the MP-005 Chromium/Firefox/WebKit/desktop/mobile compatibility matrix across every primary public/private workflow and record results in `specs/001-ai-career-os/validation/accessibility-compatibility.md`
- [ ] T265 Verify exported OpenTelemetry/Sentry/PostHog payloads contain no canary secret or private fixture content in `tests/security/telemetry-export.test.ts`
- [ ] T266 [P] Add dependency, lockfile, container, SBOM, license, and secret scanning to `.github/workflows/security.yml`
- [ ] T267 Perform database/object backup and restore drill covering auth mapping, RLS, publications, evidence, and submitted binaries in `specs/001-ai-career-os/validation/recovery-drill.md`
- [ ] T268 Implement owner data export and retention/deletion jobs, authenticated request/status/download routes, settings UI, and contract tests with documented audit/submitted-artifact exceptions in `packages/database/src/export-retention.ts`, `apps/web/app/api/v1/exports/route.ts`, `apps/web/app/api/v1/exports/[id]/route.ts`, `apps/web/app/api/v1/exports/[id]/download/route.ts`, `apps/web/app/(dashboard)/settings/data/page.tsx`, and `tests/contract/exports-api.contract.test.ts`
- [ ] T269 Optimize measured web bundles, images, caching, indexes, and query plans without weakening boundaries in `specs/001-ai-career-os/validation/performance-tuning.md`
- [ ] T270 Benchmark exact versus HNSW filtered recall/latency and gate any approximate-index rollout in `tests/evals/retrieval/hnsw-benchmark.ts`
- [ ] T271 [P] Write runbooks in `docs/runbooks/drive.md`, `docs/runbooks/job-sources.md`, `docs/runbooks/ai-providers.md`, `docs/runbooks/parsers.md`, `docs/runbooks/publication.md`, `docs/runbooks/workflows.md`, and `docs/runbooks/incidents.md`
- [ ] T272 Create reviewed environment definitions in `infra/environments/vercel.md`, `infra/environments/supabase.md`, `infra/environments/cloud-run.md`, `infra/environments/inngest.md`, and `infra/environments/opentelemetry.md`
- [ ] T273 Implement preview, migration dry-run, worker canary, full evaluation, and human production-approval release workflow in `.github/workflows/release.yml`
- [ ] T274 [P] Record the ADR index and implemented architecture deviations from research in `docs/architecture/decisions/README.md` and `docs/architecture/decisions/0001-implementation-deviations.md`
- [ ] T275 Re-run all 18 constitutional gates and document any rejected exception in `specs/001-ai-career-os/validation/constitution-check.md`
- [ ] T276 Conduct human release review, confirm no autonomous merge/deploy path, and sign the release checklist in `specs/001-ai-career-os/validation/release-checklist.md`

**Checkpoint**: The selected release is ready only when all applicable validation artifacts pass and a
human approves promotion.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **Phases 3–11 — User Stories**: Isolated test development may start after Phase 2 with documented
  fixtures. Production implementation follows the hard dependencies in the table below.
- **Phase 12 — Polish/Release**: Depends on every story selected for that release.

### User Story Dependencies

| Story | Hard dependency | Independent fixture path | Production integration path |
|-------|-----------------|--------------------------|-----------------------------|
| US1 Trusted Career Knowledge | Foundation | Empty seeded owner + documents | Canonical source for every later story |
| US2 Public Portfolio | Foundation + US1 publication schema | Seeded active publication after schema exists | Consumes US1 publication snapshots |
| US3 Public Intelligence | Foundation + US1; US2 for integrated UI | Seeded public evidence snapshot | Consumes US1 publication and renders in US2 |
| US4 Opportunities | Foundation + US1 career/evidence schema | Seeded Career Brain evidence + fake sources | Uses US1 private evidence for matching |
| US5 Application Package | Foundation + US1 + US4 job schema | Seeded job, JD, profile, and career evidence after schemas exist | Uses US1 facts and US4 jobs |
| US6 Interview Preparation | Foundation + US1 + US5 application schema | Seeded application, JD, and career evidence after schemas exist | Uses US1 facts and US5 applications |
| US7 Technical Writing | Foundation + US1 + US2 publication route | Seeded evidence/publication after schemas exist | Uses US1 evidence and US2 public route |
| US8 Analytics | Foundation + production schemas/event producers from US2, US4, US5, US6, US7 | Seeded lifecycle/events after schemas exist | Aggregates those stories' activity |
| US9 Safe Automations | Foundation; integrated controls depend on selected workflow-producing stories | Fake workflows/providers | Observes and controls workflows from all selected stories |

### Preferred Delivery Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4 -> US5 -> US6 -> US7 -> US8 -> US9 -> Release
                          \---------------- stories may start from fixtures in parallel ---------------/
```

### Within Each User Story

1. Write the story’s tests and confirm expected failures.
2. Apply schema/migrations and database security tests.
3. Implement repositories and deterministic domain services.
4. Implement AI/provider/workflow pieces only where the story requires semantic reasoning.
5. Implement HTTP/event contracts.
6. Implement accessible UI and story integration.
7. Pass the independent test and preserve all previously completed story tests.

## Parallel Opportunities

### Setup and Foundation

- After T001–T002, T003–T014 can be divided by web, worker, tooling, local infrastructure, and CI paths.
- After T021–T022, independent foundation batches include T023–T028, T030/T032/T033, T035–T037,
  T040–T044, and fixture work T045.

### Per-Story Parallel Batches

| Story | Parallel test batch | Parallel implementation batch after schema/tests |
|-------|---------------------|--------------------------------------------------|
| US1 | T046–T053 | T061–T062 after sequential migrations T055–T060; UI T078 alongside parser workflow after its prerequisites |
| US2 | T080–T084 | T088, T090–T092, T094–T095 after T085–T087 |
| US3 | T099–T105 | T109–T110, T114–T115 after T107–T108 |
| US4 | T125–T130 | Adapters T137–T140, scoring T146–T147, and UI T151–T152 after sequential migrations T132–T134 |
| US5 | T154–T160 | Services T167–T168/T170–T171 and renderers T174–T175 after sequential migrations T162–T164, then UI T179 |
| US6 | T181–T186 | T193, T195–T196, endpoints/UI T200/T202/T203 after domain services |
| US7 | T206–T208 | T212, UI T216–T217 after post services |
| US8 | T221–T225 | analytics services T232–T234 after event/aggregation foundation |
| US9 | T240–T244 | health/run repositories T250–T251 and UI T254–T256 after control services |

### Parallel Execution Examples

```text
US1 tests: T046, T047, T048, T049, T050, T051, T052, T053
US2 sections after public repository/page: T088, T090, T091, T092, T094, T095
US3 retrieval/provider work: T109, T110, T114, T115
US4 provider adapters: T137, T138, T139, T140
US5 composition/rendering: T170, T171, T174, T175
US6 question/story work: T193, T195, T196
US7 CMS UI: T216, T217
US8 analytics services: T232, T233, T234
US9 operations UI: T254, T255, T256
Release evidence: T259, T261, T262, T263, T264, T266, T271, T274
```

Do not parallelize tasks that edit the same migration, route, or service file. `[P]` never overrides the
explicit order inside a story.

## Implementation Strategy

### Strict MVP First — User Story 1

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation.
3. Complete Phase 3 US1 Trusted Career Knowledge.
4. Stop and validate the independent US1 test and constitutional gates.
5. Demonstrate a private canonical Career Brain with staged public projection.

This is the smallest trustworthy product slice. It intentionally does not yet provide the final public
portfolio; add US2 for a public-facing MVP.

### Public-Facing MVP

1. Strict MVP (Setup + Foundation + US1).
2. Add US2 one-page public portfolio.
3. Add US3 public Ask My AI and recruiter JD matching.
4. Re-run privacy, accessibility, performance, and grounding release gates.

### Incremental Delivery

1. US1 establishes trusted data and publication.
2. US2 exposes the evidence-safe public experience.
3. US3 adds public intelligence.
4. US4 adds opportunity tracking and discovery.
5. US5 adds owner-reviewed application preparation.
6. US6 adds interview preparation and learning.
7. US7 adds evidence-safe writing.
8. US8 adds private analytics and career gaps.
9. US9 makes all automation controllable and observable.
10. Phase 12 hardens only the stories selected for release, then expands as later stories complete.

### Parallel Team Strategy

After Foundation, teams may implement stories against seeded contracts. Integration order remains:
Career Brain/publication -> public portfolio/intelligence -> jobs -> applications -> interviews ->
content/analytics -> unified operations. A story cannot claim completion until its production integration
path and independent fixture path both pass.

## Notes

- `[P]` means different files and no incomplete dependency in the stated batch.
- Story labels provide traceability; Setup, Foundational, and Polish tasks intentionally have none.
- Tests precede implementation because the specification and constitution require proportional coverage.
- Every migration includes constraints, indexes, RLS/grants, audit fields, and recovery notes where
  applicable.
- Every AI task records provider/model, prompt/schema/retrieval versions, latency/usage, evidence, and safe
  failure without logging sensitive content.
- No task may add automatic job/form submission, recruiter messaging, automatic publication/evidence
  approval, meeting bots, live transcription, hidden interview assistance, or autonomous deployment.
- Commit after each task or small coherent task group and rerun affected contracts before the checkpoint.
