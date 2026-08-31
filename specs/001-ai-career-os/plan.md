# Implementation Plan: AI Career OS and Intelligent Portfolio

**Branch**: `master` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ai-career-os/spec.md`

**Note**: This plan completes Phase 0 research and Phase 1 design. Executable work breakdown belongs in
`tasks.md`, generated separately by `$speckit-tasks`.

## Summary

Build an evidence-backed Personal AI Career Operating System with three explicit surfaces: an immutable
published one-page portfolio, a canonical private Career Brain, and authenticated career workflows for
jobs, applications, interviews, content, and analytics. Use a modular TypeScript/Python monorepo: Next.js
for the web/BFF, a separately isolated Python worker for untrusted documents and AI/data pipelines,
PostgreSQL with Supabase Auth/Storage and pgvector for authoritative state, and Inngest for durable
mixed-language workflows.

The central technical invariant is that professional output is a derivation of approved Career Brain
facts and immutable evidence. Public content is copied into an allowlisted, versioned publication
snapshot; public retrieval can query only that boundary. Hybrid lexical/vector retrieval preserves
provenance, deterministic code validates citations and calculates scores, and AI remains a replaceable
reasoning capability with no authority to publish, submit applications, communicate externally, or
change verified facts.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node.js 24.x; Python 3.13.15; SQL for PostgreSQL 17

**Primary Dependencies**: Next.js 16.3.3, React 19.2.8, Tailwind CSS 4.3.3, shadcn/ui 4.19.0,
Motion 13.1.1, Supabase JS 2.112.4, Supabase SSR 0.12.5, Inngest TypeScript/Python SDKs, pypdf,
python-docx, provider SDK adapters, OpenTelemetry, Sentry, PostHog

**Storage**: Managed Supabase PostgreSQL 17 with pgvector 0.8.6; private Supabase Storage for source and
generated binaries; public Storage only for explicitly published sanitized media

**Testing**: Vitest, Testing Library, Playwright, axe accessibility checks, pytest, pgTAP, contract
fixtures, versioned AI evaluation datasets, k6 performance tests

**Target Platform**: Responsive modern web browsers; Vercel Node runtime for web/BFF in Frankfurt;
managed Supabase in Frankfurt; non-root OCI Python worker on Google Cloud Run in the same region;
Inngest Cloud durable workflow control plane

**Project Type**: Greenfield web application plus asynchronous worker in a modular monorepo

**Performance Goals**: Meet MP-001–MP-004 from `spec.md`: p95 usable public content within 2.5 seconds
under the defined cold-cache mobile/network/concurrency profile; p95 ordinary owner acknowledgement within
1 second across the defined action set; p95 AI/match progress within 3 seconds at ten concurrent requests;
and p95 list/detail reads within 2 seconds at the complete NFR-010 corpus sizes

**Constraints**: Single owner initially; privacy and authorization fail closed; public AI sees only active
published evidence; every material career claim is evidence-linked; deterministic scoring and state
machines; no automatic application/form submission, recruiter communication, publishing, evidence
approval, or live interview assistance; external data is untrusted; private content is absent from
ordinary telemetry; public portfolio stays available when AI/integrations fail

**Scale/Scope**: One owner; at least 10,000 career facts/evidence links, 10,000 evidence chunks, 25,000
jobs, 2,500 applications, 1,000 generated artifacts, and five years of analytics; nine prioritized user
journeys, 126 functional requirements, seven state machines, and core plus planned-expansion releases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| # | Constitutional gate | Pre-design | Post-design evidence |
|---|---------------------|------------|----------------------|
| I | Career Brain is canonical | PASS | All projections, retrieval, artifacts, jobs, and interview material reference versioned Career Brain facts/evidence; no hard-coded career copy. |
| II | Evidence-grounded AI | PASS | Immutable source/chunk provenance, generation contexts, claim-evidence links, deterministic citation validation, and abstention contracts. |
| III | Impact-first representation | PASS | Projection, achievement, metric, ResumeData, and public portfolio contracts prioritize contextualized verified impact. |
| IV | Owner-controlled career truth | PASS | Extracted facts remain candidates; only owner review transitions to approved/public eligibility. Original sources and journals are append-only. |
| V | Privacy by default | PASS | Private defaults, default-deny RLS, private objects, minimal telemetry, explicit publication snapshot, and retention classes. |
| VI | Human approval for consequential actions | PASS | Separate publish/final/submitted-record commands; no application, communication, salary submission, or live interview endpoints/tools. |
| VII | Deterministic logic before AI | PASS | Database state machines, scoring, deduplication, permissions, validation, rendering, scheduling, and citation checks are deterministic. |
| VIII | Modular provider architecture | PASS | Capability-aware AI ports, job adapter contract, Inngest events, and provider configuration isolate vendors. |
| IX | Secure external-data handling | PASS | Isolated parsers, quarantine, SSRF-aware fetch, allowlisted tools, output sanitization, resource limits, and prompt-injection policy gateway. |
| X | Observable/resilient automation | PASS | Durable step contracts, app-owned run/step records, outbox, idempotency keys, retries, partial states, and graceful degradation. |
| XI | Testable AI behavior | PASS | Versioned evaluation datasets and gates for grounding, citations, abstention, leakage, injection, schemas, quality, latency, and cost. |
| XII | No fabricated claims | PASS | Unsupported/conflicting claim states, deterministic support validation, and required abstention are represented in schema and contracts. |
| XIII | Public/private boundary | PASS | Published snapshot is separate from private Career Brain; authorization filters run inside retrieval; negative RLS/contract tests required. |
| XIV | Accurate contribution attribution | PASS | Contribution type is modeled on projects/achievements/stories and validated in generated/public claims. |
| XV | Confidential employer protection | PASS | Separate private/public descriptions, confidential visibility, sanitized publication pipeline, and prohibited public fields. |
| XVI | Versioned generated artifacts | PASS | Structured content, templates, renderer, model/prompt, evidence, owner edits, binaries, hashes, and final/submitted states are immutable versions. |
| XVII | Accessible/performance UX | PASS | Semantic progressive timeline, reduced motion, WCAG AA tests, performance targets, static public fallback, and explicit budgets. |
| XVIII | Incremental specification-driven development | PENDING REVIEW | Design is split into independently verifiable release increments. Implementation remains blocked until the specification, plan, contracts, data model, dependencies, security implications, and enriched task metadata receive recorded human approval. |

### Workflow Quality Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Testable requirements and state transitions | PASS | `spec.md`, `data-model.md`, contracts, and quickstart scenarios trace functional, AI, privacy, state, and outcome requirements. |
| Architecture trade-offs documented | PASS | `research.md` records 20 decisions with rationale and alternatives. |
| Authorization and public/private flow documented | PASS | Publication snapshot, RLS model, API auth classes, retrieval scope, and negative tests are explicit. |
| Observability and failure isolation documented | PASS | Inngest event/step contracts, app-owned runs, Collector privacy boundary, and failure-mode scenarios. |
| Migration, rollout, and recovery documented | PASS | Data model migration section and deployment/rollout strategy below. |
| AI provider/prompt/evidence/eval contracts documented | PASS | `contracts/ai-contracts.md`, research decisions 7–16, evaluation gates. |
| Constitutional exceptions | PASS | None required. |

**Gate result**: Technical design gates pass, but the constitutional implementation gate remains
**PENDING HUMAN REVIEW**. No implementation, merge, or deployment is authorized by this plan status.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-career-os/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   ├── ai-contracts.md
│   ├── events.md
│   ├── http-api.md
│   └── job-source-adapter.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md                 # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── blog/[slug]/page.tsx
│   │   │   └── projects/[slug]/page.tsx
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── career-brain/
│   │   │   ├── documents/
│   │   │   ├── jobs/
│   │   │   ├── applications/
│   │   │   ├── interviews/
│   │   │   ├── journal/
│   │   │   ├── artifacts/
│   │   │   ├── analytics/
│   │   │   ├── blog/
│   │   │   └── settings/
│   │   └── api/v1/
│   ├── components/
│   │   ├── portfolio/
│   │   ├── dashboard/
│   │   └── shared/
│   ├── inngest/
│   └── tests/
└── worker/
    ├── src/career_worker/
    │   ├── ingestion/
    │   ├── parsing/
    │   ├── extraction/
    │   ├── retrieval/
    │   ├── providers/
    │   ├── evaluations/
    │   ├── workflows/
    │   └── security/
    ├── tests/
    ├── pyproject.toml
    └── uv.lock

packages/
├── ai/                     # Provider ports, schemas, policy gateway, prompts
├── career/                 # Career facts, evidence, projection domain
├── knowledge/              # Retrieval, provenance, review contracts
├── jobs/                   # Adapters, normalization, dedupe, matching/scoring
├── applications/           # Forms, answers, packages, artifact composition
├── interviews/             # Processes, stages, kits, stories, learning
├── compensation/           # Benchmarks and deterministic recommendations
├── documents/              # Source/version and ingestion coordination
├── analytics/              # Allowlisted events and deterministic aggregates
├── database/               # Generated types, owner/public repositories, SQL helpers
├── auth/                   # Session, authorization, confirmation policies
├── contracts/              # Executable HTTP/event/JSON schemas and fixtures
├── ui/                     # Owned accessible components/design tokens
├── config/                 # Validated environment/configuration
└── observability/          # OTel setup, redaction, safe errors

supabase/
├── migrations/
├── seed/
├── tests/
└── config.toml

tests/
├── contract/
├── e2e/
├── accessibility/
├── performance/
├── security/
├── evals/
└── fixtures/

infra/
├── worker/
├── observability/
└── environments/

pnpm-workspace.yaml
turbo.json
package.json
pnpm-lock.yaml
```

**Structure Decision**: Use one deployable web application and one separately isolated Python worker,
with domain packages enforcing internal boundaries. `packages/database` owns generated TypeScript types
and user-scoped repositories; SQL migrations are canonical. Python uses contract schemas and explicit
SQL repositories rather than introducing a second schema-authoring ORM. No package maps one-to-one to a
microservice. Public/private route groups are separated structurally, but database policy is the final
authorization boundary.

## Architecture Overview

### Runtime Context

```text
Public Visitor ───────────────┐
Career Owner ── Auth Session ─┼──> Next.js Web + BFF (Vercel)
                              │       │
Provider Webhooks ────────────┘       ├──> Supabase Auth
                                      ├──> PostgreSQL + pgvector
                                      ├──> Private/Public Storage
                                      ├──> Inngest Events/TS Functions
                                      └──> Public AI Provider Adapter
                                                   │
Inngest Durable Workflow <─────────────────────────┤
        │                                          │
        └──> Python Worker (isolated OCI) ─────────┘
               ├── document quarantine/parsers/OCR boundary
               ├── extraction/embeddings/reranking/evaluations
               └── private data/provider adapters

All runtimes ──> OpenTelemetry Collector ──> sanitized Sentry/PostHog/trace backends
```

### Domain Ownership

| Domain | Owns | Does not own |
|--------|------|--------------|
| Auth | session verification, owner policy, confirmation tokens | career visibility or publication content |
| Career | facts, trust, evidence links, review, projection rules | raw document parsing or AI provider calls |
| Knowledge | source versions, chunks, retrieval, provenance | fact approval or public publishing |
| Portfolio | staged/published snapshots and public read model | canonical career truth |
| Documents | connections, versions, ingestion coordination | approval of extracted facts |
| Jobs | sources, normalization, dedupe, requirements, deterministic scores | application artifacts or submissions |
| Applications | workspaces, forms, answers, artifacts, packages | job discovery or external submission |
| Interviews | processes, stages, kits, stories, learning | live meeting participation |
| Content | article versions and owner publication | treating articles as career proof |
| Analytics | allowlisted events and deterministic aggregates | raw sensitive text or public reports |
| AI | capability ports, prompts, policies, run/eval records | authorization, scores, state transitions, approval |
| Automation | durable coordination, retries, schedules, run visibility | new business authority |

## UI Architecture

### Public Portfolio

- Render approved publication data in Server Components so core content works without client JavaScript.
- Use semantic landmark sections with stable anchors: About, Experience, Projects, Impact, Skills,
  Writing, Match, Ask, and Contact.
- Desktop career journey uses a sticky visual rail and Intersection Observer to update active stage.
  Mobile and reduced-motion modes use a semantic ordered vertical timeline; no scroll interception.
- Keep Match and Ask as isolated client islands with progressive loading, streaming status, citations,
  abuse/rate feedback, and an accessible no-evidence state.
- Cache by immutable publication version. Publishing/withdrawal invalidates the corresponding tag; no
  authenticated or AI response is CDN/ISR cached.
- Dedicated article/project routes read the same active publication snapshot, not private source tables.

### Private Career OS

- Provide explicit owner sign-in, verified callback, sign-out, expired-session, and unauthorized states.
  Authentication browser tests cover successful entry, invalid/expired links, callback tampering,
  session expiry, and attempted access to every private route group.
- Route groups require a verified session before layout/data rendering and repeat authorization in every
  mutation. Dashboard modules use owner-scoped repositories and private/no-store responses.
- `/dashboard` is the authenticated landing page and aggregates high-fit jobs, applications awaiting
  action, interviews/preparation, fact review, portfolio activity, and draft content. `/analytics`
  provides deeper reports and links back to those actionable records.
- Career Brain review favors source/fact side-by-side evidence and enables approve, edit-and-approve,
  reject, defer, trust, and visibility actions in three or fewer primary interactions.
- Jobs provide list and Kanban projections over one status history. Application workspaces use nested
  tabs but one authoritative job/application state.
- Long work always creates a run first, then shows durable progress, retry/cancel eligibility, partial
  results, and safe errors. Optimistic UI is limited to reversible local interactions.
- Generated content editors operate on structured content, display claim/evidence coverage, and create a
  new version on save. Final/submitted versions are read-only.
- Forms, dialogs, charts, timelines, editors, toasts, and loading/empty/error states are keyboard and
  screen-reader tested; charts always provide a table/text equivalent.

## Backend and Interface Architecture

- Server Components perform owner/public reads through separate repositories.
- Server Actions handle mutations tied to authenticated UI forms; Route Handlers implement the versioned
  HTTP contract, public streams, OAuth callbacks, provider webhooks, signed downloads, and workflow serve
  endpoints.
- Runtime schemas from `packages/contracts` validate at every boundary. Database-generated types do not
  replace input validation.
- Owner identity is taken only from the session; body/query `ownerId` is rejected.
- Mutations use revision tokens and idempotency keys. Domain changes and outbox events commit together.
- HTTP handlers return quickly after creating asynchronous runs. Large files and generated binaries use
  private object transfer, never event payloads or database JSON blobs.
- All server-side URL retrieval uses a shared safe-fetch boundary enforcing HTTPS, DNS/IP validation on
  every redirect, private/link-local/metadata-network denial, response size/time limits, content-type
  allowlists, rate limits, and sanitized failures. Domain adapters may narrow but never bypass it.
- Error translation maps internal/provider errors to stable Problem Details without leaking source text,
  credentials, internal hosts, SQL, prompts, or stack state.

The complete route and stream contract is [contracts/http-api.md](contracts/http-api.md).

## Database Architecture

- PostgreSQL migrations in `supabase/migrations` are the only schema authority; both languages consume
  generated/contract types rather than defining competing schemas.
- Private domain tables live in `app`; immutable public snapshots live in `published`; exposed `api`
  views/functions are explicitly granted. Anonymous grants never touch `app`.
- RLS defaults deny. Separate policies cover select, insert, update, and delete with both `USING` and
  `WITH CHECK`. Policy predicates and foreign keys are indexed.
- Service-role use is restricted to audited workflow repositories. Normal owner requests preserve the
  user JWT/RLS context. Security-definer functions are narrowly scoped, fixed `search_path`, validated,
  and privilege-tested.
- Append-only versions/history protect facts, sources, chunks, prompts, publications, submitted
  artifacts, journals, audit, and state transitions.
- The outbox, idempotency keys, unique source/version hashes, and compare-and-set revisions make retries
  safe across database and workflow boundaries.

Detailed fields, relations, state transitions, indexes, validation, and recovery are in
[data-model.md](data-model.md).

## Career Brain and Publication Architecture

```text
Manual Fact / Document / Approved Public Source
                     │
                     ▼
Immutable Evidence Source + Version + Chunks
                     │
        Extraction Candidates (not trusted)
                     │
              Owner Review/Edit
                     ▼
Canonical Fact Version + Claim-Evidence Links
                     │
          Portfolio Projection Rules
                     │
     Validate support/privacy/confidentiality
                     ▼
Staged Snapshot ── Owner Confirmation ──> Active Published Snapshot
```

- Manual owner facts enter as owner-verified sources but remain distinguishable from documents.
- Model confidence and evidence trust are independent. AI cannot write approval, visibility, projection,
  score, or publication state.
- Professional projects can be represented without source access using owner-approved evidence and
  sanitized public descriptions. Contribution type prevents unsupported sole-ownership language.
- Public snapshots copy only allowlisted fields and safe citation excerpts. Cache invalidation and public
  AI both bind to an immutable publication version.
- Withdrawal removes reachability immediately; historical publication remains private for audit.

## Document and Google Drive Architecture

1. OAuth grants the minimum Drive scope for the dedicated folder/corpus and stores credentials by secret
   reference.
2. Bootstrap stores a Drive change token; webhook wakes a deduplicated drain; scheduled reconciliation
   covers missed/expired notifications.
3. Drain reads every page oldest-first, writes document changes and outbox events, then commits the new
   token atomically.
4. Download/export writes immutable private bytes, validates metadata/magic/hash, and creates a source
   version or records unchanged content.
5. A no-egress parser container applies resource limits, extracts normalized text and exact anchors, and
   routes only necessary pages to bounded OCR.
6. Chunking preserves document/page/section/offset provenance. Extraction uses schema-only, no-tool AI.
7. Candidates await owner review. Embeddings/indexes update by immutable version and approved visibility.
8. Removal/permission loss creates a tombstone and revokes retrieval/publication; it does not silently
   delete approved facts or history.

## RAG and Evidence Verification Architecture

```text
Question + authorized scope
        ├── structured fact filters
        ├── lexical top 50 (GIN/ts_rank_cd)
        └── vector top 50 (exact, later HNSW)
                    │
          Reciprocal Rank Fusion
                    │
           optional top-25 rerank
                    │
       6–10 immutable evidence handles
                    │
         schema-constrained generation
                    │
 deterministic handle + claim validation
                    ▼
 answer with citations OR explicit abstention
```

- Authorization, publication, deletion, trust, and metadata filters occur in both candidate queries.
- Lexical/vector/fusion/reranker ranks remain individually observable. Approximate retrieval is compared
  with sampled exact results for recall.
- The model receives opaque handles mapped server-side to immutable chunks; it cannot author source URLs
  or bibliography metadata.
- The verifier rejects unknown handles, stale/unavailable versions, wrong offsets, and unsupported claims.
- Public and private retrieval are separate entry points and repository types, not a caller flag.
- Evaluations cover Recall@k, MRR/nDCG, citation precision/recall, grounding, abstention, filtered-ANN
  recall, malicious content, leakage, latency, and provider fallback.

## Agent and AI Architecture

### Career Orchestrator

The orchestrator classifies a bounded task, chooses a versioned workflow, checks authorization/budget,
invokes deterministic services and only the needed AI capability, tracks dependencies, validates output,
and records the run. It is not itself a universal autonomous agent.

### Reasoning Domains

| Domain | AI-appropriate capabilities | Deterministic companions |
|--------|-----------------------------|--------------------------|
| Career Intelligence | extraction, semantic evidence verification, gap explanation | fact state, trust, visibility, publication validation |
| Job Intelligence | requirement extraction, source-result interpretation, match explanation | normalization, dedupe, score formulas, lifecycle |
| Application Intelligence | answer/CV/letter composition, compensation evidence synthesis | profile fields, limits, templates, versions, approval |
| Interview Intelligence | stage proposal, question prediction, preparation, qualitative feedback | stage state/history, evidence maps, journal integrity |
| Public Intelligence | question classification, grounded answer, match explanation | public scope, retrieval, citations, match score |
| Content Intelligence | topic/outline/draft/rewrite | evidence retrieval, versions, publication approval |

- Provider ports separate text, structured, streaming, embeddings, reranking, and tool proposals.
- Narrow policy-gated tools expose only domain methods; no arbitrary SQL, fetch, shell, filesystem, email,
  publishing, or submission tool exists.
- Prompts, schemas, adapters, configurations, evaluation datasets, and aliases are versioned. Fallback is
  workload-specific and cannot change privacy region/provider approval silently.

See [contracts/ai-contracts.md](contracts/ai-contracts.md).

## Job Source and Opportunity Architecture

- A source adapter exposes capabilities, connection test, search, fetch, normalize, and health only.
  It cannot persist canonical jobs or score/apply.
- Configurable endpoints pass the SSRF allow/deny policy; credentials remain secret references. Owner
  field mappings are declarative and validated, never executable code.
- Search orchestration fans out by enabled source with provider/user concurrency and rate limits. Each
  source can succeed/fail independently; the run becomes partial rather than discarding useful results.
- Canonicalization uses exact source identity, URL, normalized company/title/location, and description
  fingerprint/similarity. Ambiguous merges are reviewable and reversible.
- JD requirements are extracted/versioned, then each requirement retrieves evidence independently.
  Career Match and Opportunity Score are separate versioned deterministic calculations.
- Manual, referral, recruiter, and automated jobs enter the same canonical pipeline and status machine.

See [contracts/job-source-adapter.md](contracts/job-source-adapter.md).

## Automation Architecture

- Inngest TypeScript and Python functions share the versioned event envelope in
  [contracts/events.md](contracts/events.md).
- Schedules create a logical date and deterministic operation key. Domain state plus outbox commit before
  dispatch. App-owned run/step records remain authoritative after vendor trace retention expires.
- Each external side effect is one durable step with explicit timeout, retry classification, output
  reference, and idempotency key. Large data passes by private reference.
- Cancellation is cooperative between steps; active parser/provider calls have their own hard timeout.
- Automations are allowlisted to ingest, search, analyze, draft, aggregate, notify, or export. They cannot
  publish, submit, send, approve, or mutate verified evidence.
- Failed Drive/AI/job providers degrade only dependent features; public snapshots and verified Career
  Brain remain available.

## Application and Generated Document Architecture

- Application workspaces bind to an immutable JD version and current job/application status history.
- Accessible form analysis is optional; paste/manual fields always work. Sensitive demographic fields
  are manual-only. Deterministic profile fields bypass AI.
- Draft answers use question/JD context, evidence handles, and length validators. Saved answers are
  revalidated and stripped of stale company context before adaptation.
- CV and letter composition produces schema-validated `ResumeData`/`LetterData`; deterministic templates
  render PDF and DOCX. Generated content cannot control HTML/CSS, arbitrary links, scripts, or layout.
- Every material claim maps to Career Fact and Evidence versions. Owner edits create a new immutable
  artifact version; final/submitted snapshots cannot be changed.
- The system records what the owner submitted but contains no external application-submit or recruiter-
  communication capability.

## Compensation Architecture

- Research sources are lawful, dated, immutable, and tiered: same company/role, same company/similar role,
  same role/city, same role/country, then comparable market.
- Normalize currency, period, employment model, base/bonus/equity/total, and conversion date explicitly.
- Deterministic calculation produces observed range and floor/target/stretch for the chosen strategy;
  AI explains evidence and assumptions but cannot change source values or calculation.
- Every result retains confidence, research date, sources, deviations, calculation version, and history.
  Insufficient current evidence produces an explicit limitation rather than fabricated precision.

## Interview and Journal Architecture

- Interview Process creation follows source priority: JD, approved company public info, owner recruiter
  info, history, then manual input. Insufficient support sets `unknown` and prompts manual stages.
- Arbitrary stages use an append-only order/status history. Stage kits bind to JD, stage, company snapshot,
  Career Brain, and prior reviewed learning.
- Predicted questions have high/medium/lower confidence and evidence rationale; they are never guaranteed.
- Question-to-story mapping uses verified claims and accurate contribution attribution.
- Mock interviews are private practice with qualitative feedback. No meeting joining, live transcription,
  hidden assistance, or real-time employer-interview answers exist.
- Owner journal versions are immutable. Derived topics, strengths, and gaps are separate reviewable rows.

## Content and Analytics Architecture

- Articles are immutable versions with draft/scheduled/published/archived state. Career-based drafting
  retrieves evidence first; publishing requires owner confirmation and creates a public snapshot item.
- Published technical writing is indexed under a distinct evidence type that cannot independently support
  professional-experience claims.
- Public analytics accepts only versioned allowlisted events/properties under consent policy. No free text,
  raw IP, private query, evidence, prompt, answer, signed URL, or identity field is accepted.
- Private aggregates derive from lifecycle tables plus accepted events and record calculation version.
  Low-volume breakdowns use privacy thresholds.
- Gap analysis reports documented evidence status and keeps document, demonstrate, write, and learn
  recommendations distinct.

## Security and Privacy Model

### Trust Boundaries

| Boundary | Controls |
|----------|----------|
| Browser -> web/BFF | secure session, CSRF/origin checks, schema validation, rate limits, output encoding |
| Anonymous -> public AI | publication-bound scope, no tools/writes, abuse controls, input limits, citation validation |
| Web/worker -> database | separate roles, RLS, fixed grants, security-invoker views, narrow functions, TLS |
| Web/worker -> storage | private buckets, owner/path policies, short signed URLs after authorization |
| External provider -> system | OAuth/signature/state validation, endpoint allowlist, rate/time/size limits, untrusted payload |
| Document -> parser | quarantine, magic validation, malware checks, no-egress non-root container, resource limits |
| Content -> model | explicit untrusted-data boundary, no secrets, narrow/no tools, schema validation |
| Model -> action | deterministic policy gateway, current authorization, allowed schema/resource/action, confirmation |
| Runtime -> telemetry vendor | OTel Collector allowlist/redaction/pseudonymization/sampling, short retention |

### Threat Controls

- RLS and database grants are the primary data boundary; tests prove anonymous, owner, cross-owner,
  workflow, and service-role behavior for each operation.
- SSRF defense parses/normalizes, validates all DNS answers and redirects, blocks special ranges and
  internal egress, pins the checked destination, and limits response/time/decompression.
- File defense validates type/signature/size, quarantines, isolates parsers, disables macros/external
  entities/network, and caps pages, archive members, OCR, memory, CPU, and output.
- Prompt injection is mitigated by least authority and deterministic policy, not trusted-string patterns.
  Output schemas, citation allowlists, HTML/Markdown sanitization, and URL controls contain unsafe output.
- Secrets use managed references, rotate by provider, never enter browsers/prompts/events/ordinary logs,
  and are covered by CI secret scanning.
- Security/audit logs remain distinct from product analytics and traces. Retention/access is defined by
  data class, and exported telemetry is automatically inspected for canary secrets/PII.

## Observability and Failure Handling

- OpenTelemetry trace context and correlation IDs cross HTTP, outbox, Inngest, Python, provider, database,
  rendering, and notification boundaries.
- Required metadata: operation, component, version, related opaque ID, status, duration, retry, provider,
  requested/actual model, token counts, retrieval ranks/counts, citation/policy results, and safe error.
- Prompts, responses, evidence text, CV/JD/journal content, credentials, query strings, signed URLs, and
  local variables are excluded by default.
- The Collector removes unknown attributes, applies keyed pseudonyms, samples success, and routes
  sanitized errors/performance to Sentry and consented allowlisted events to PostHog.
- Source-specific circuit breakers, retry budgets, dead-letter handling, partial run states, and manual
  retry paths prevent cascading failures.

Failure expectations:

| Failure | Required behavior |
|---------|-------------------|
| Drive unavailable | existing Career Brain/public snapshot usable; run retryable/failed with safe reason |
| One job source fails | other source results retained; run partial |
| AI provider fails | deterministic/manual workflows and portfolio continue; fallback only if pre-approved |
| Parser rejects file | source quarantined; other ingestion items continue; no candidate/public data |
| Salary evidence weak | explicit insufficient evidence/low confidence; no invented range |
| Interview stages unknown | `Interview Process Unknown`; manual stage path |
| Publication validation fails | staged findings; active public version unchanged |
| Worker restarts | resume at durable step without duplicate effects |

## Testing and AI Evaluation Plan

### Test Layers

| Layer | Scope |
|-------|-------|
| Unit | scoring, state transitions, dedupe fingerprinting, evidence validation, limits, normalization, salary conversion, timeline projection |
| Database | migrations, constraints, indexes, append-only guards, RLS/grants/functions, public snapshot allowlist, cross-owner denial |
| Contract | HTTP schemas/streams, events, job adapters, AI providers, artifact schemas, version compatibility |
| Integration | Career Brain, Drive sync, parser isolation, hybrid retrieval, workflows, providers, application packages, rendering, interview kits |
| End-to-end | every prioritized user journey and quickstart scenario across desktop/mobile/accessibility modes |
| Compatibility | MP-005 browser matrix across Chromium, Firefox, WebKit/Safari, iOS Safari, and Android Chrome |
| Security | SSRF, upload bombs, XSS/sanitization, CSRF, auth/RLS bypass, prompt injection, tool policy, secret/telemetry leakage |
| Performance | public content, stream start, retrieval, large owner corpus, scheduled source fan-out, analytics aggregation |
| Resilience | retry/idempotency, worker restart, provider outage, partial failure, cancellation, restore |
| AI evaluation | extraction, retrieval recall, grounding, citations, abstention, privacy, JD matching, answer/CV quality, question relevance |

### Release Metrics

- Required: 100% material public AI claims have valid public citations; zero private leakage; at least 99%
  correct abstention on unsupported cases; all meaningful JD requirements independently scored.
- Retrieval: labeled Recall@k/MRR/nDCG and citation recall thresholds set from baseline before HNSW/reranker
  rollout; approximate search cannot regress material filtered recall beyond the approved tolerance.
- Generated artifacts: 100% material career claims evidence-linked or explicitly owner-intent; schema and
  word/character-limit validity; exact version reproduction.
- Security: all mandatory adversarial fixtures pass; no fixture secret or private content appears in
  exported telemetry.
- UX: SC-001–SC-022 and NFR-001–NFR-012 mapped to CI reports and preview acceptance evidence using
  MP-001–MP-007, including recorded usability scripts, browser matrix, load profile, and document corpus.

## CI/CD and Deployment

### Pull Request Pipeline

1. format, lint, TypeScript strict check, Python lint/type check, dependency/secret/license scan;
2. TypeScript/Python unit and contract tests in parallel;
3. disposable local PostgreSQL migration + pgTAP/RLS tests;
4. integration tests with fake providers and local Inngest;
5. build web, worker image, generated schemas, PDF/DOCX fixture hashes;
6. browser E2E, accessibility, and selected security tests against preview;
7. AI evaluation smoke suite on non-sensitive fixtures with budget cap;
8. architecture/requirement trace report and human review.

### Main/Release Pipeline

- Re-run full tests, complete AI/adversarial evaluation suite, performance smoke, image/SBOM scanning,
  migration dry run, and telemetry privacy inspection.
- Create Vercel preview, isolated preview Supabase branch/project, preview Inngest environment, and worker
  revision with environment-specific secrets and callbacks.
- Production promotion requires human approval, migration backup/forward-recovery review, then expand
  migration -> compatible app/worker -> backfill -> verification -> contract cleanup in a later release.
- Use canary/limited traffic for AI prompt/model/retrieval aliases and worker changes. Alias rollback must
  not require code deployment.
- Codex may implement reviewed tasks and run checks but cannot merge or deploy production autonomously.

### Backup and Recovery

- Managed point-in-time database recovery plus regular logical export of core owner data.
- Versioned/retained private object storage for evidence and final/submitted artifacts.
- Restore drills validate auth subject mapping, RLS, publication selection, evidence/chunk hashes, artifact
  binaries, workflow recovery, and absence of accidentally public objects.
- Provider connections and secrets are reauthorized/recreated rather than included in portable exports.

## Delivery Sequence

Each increment is independently testable and must pass its constitutional gates before the next relies on
it. Exact tasks and dependencies are produced by `$speckit-tasks`.

1. **Foundation**: workspace, CI, configuration, local stack, observability privacy boundary, database
   migration harness, Auth/RLS, design system, public/private route shells.
2. **Career Brain and Document Intelligence**: manual facts, structured career domains,
   evidence/version/trust/review, Drive connection/change cursor, uploads, isolated parsing, chunk
   provenance, extraction candidates, idempotent embeddings, projection rules, and staged publication.
3. **Public Portfolio**: one-page semantic experience, career timeline, projects, impact, skills, writing,
   contact, public detail routes, performance/accessibility baselines.
4. **Public Intelligence**: hybrid retrieval, evidence handles, grounded Ask My AI, public JD matcher,
   deterministic scoring, evaluations, abuse controls.
5. **Job Core**: manual job entry, canonical job/JD versions, requirements, job lifecycle, list/Kanban,
   career/opportunity scores.
6. **Application Core**: workspaces, owner-uploaded/linked documents, forms/manual fields, deterministic profile, answer drafts, CV/letter
   schemas/renderers/versions, packages, journal.
7. **Automated Job Discovery**: source adapter framework, connection tests, profiles, schedules, fan-out,
   dedupe, failure isolation, notifications.
8. **Compensation and Interview Intelligence**: source-tiered compensation, interview processes/stages,
   kits, STAR stories, mock practice, post-interview insights.
9. **Content and Analytics**: blog workflow/AI assistance, technical-knowledge indexing, privacy-conscious
   portfolio events, application/interview analytics, career-gap analysis.
10. **Automation Operations and AI Configuration**: per-task AI settings, schedules, bounded workflow
    coordination, inspection, retry/cancel, provider health, and human-control enforcement.
11. **Hardening and Launch**: full adversarial/AI evaluations, performance, accessibility, compatibility, recovery,
   retention/export, operational runbooks, canary/rollback rehearsal.

## Requirement Traceability

| Requirements | Primary design area | Primary validation |
|--------------|---------------------|--------------------|
| FR-001–FR-006, PSR-001–PSR-003 | Auth/RLS, public/private repositories, audit, dashboard | quickstart 1–2; DB negative tests |
| FR-007–FR-027, ST-001–ST-002 | Career Brain, evidence, documents, review, projection | quickstart 2–3; provenance/integrity tests |
| FR-028–FR-038, NFR-001–NFR-003 | Public UI architecture | quickstart 1; E2E/a11y/performance |
| FR-039–FR-050, AIR-001–AIR-008 | RAG, public AI, JD match | quickstart 5–6; AI/security evals |
| FR-051–FR-068, ST-003 | Job adapters, workflows, canonical jobs/scores | quickstart 7; contract/resilience tests |
| FR-069–FR-092, ST-004 | Application/artifact/compensation domains | quickstart 8; schema/render/evidence tests |
| FR-093–FR-108, ST-005 | Journal/interview domains | quickstart 9; integrity/qualitative evals |
| FR-109–FR-119, ST-006 | Content/analytics | quickstart 10; publication/privacy/aggregate tests |
| FR-120–FR-126, ST-007, NFR-005–NFR-009 | AI ports, automation, observability/failure | quickstart 4 and 11; retry/leakage tests |
| NFR-004, NFR-010–NFR-012, SC-001–SC-022 | Performance, scale, compatibility, export, all domains | full release-gate suite |

## Complexity Tracking

No constitutional violations or exceptions are required. The second deployable (`apps/worker`) is not a
domain microservice: it is the mandated isolation/runtime boundary for untrusted document parsing and
Python-specific AI/data processing. Its necessity, narrow interface, and failure isolation are documented
in research decisions 1, 9, 11, 17, and 18.
