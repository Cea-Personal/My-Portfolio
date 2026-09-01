# Phase 0 Research: AI Career OS and Intelligent Portfolio

**Date**: 2026-08-31  
**Status**: Complete — all technical-context unknowns resolved  
**Inputs**: `spec.md`, project constitution v1.0.0, attached master brief

## 1. Application Architecture

**Decision**: Use a modular monorepo with a Next.js web application as the public UI, authenticated UI,
and backend-for-frontend; a separately deployed Python worker for document and AI-heavy processing; and
shared domain packages. Do not create independent microservices for each domain.

**Rationale**: The web application can handle ordinary request/response work, authenticated mutations,
streaming responses, callbacks, and webhooks. Python has clear value for parsing, extraction, evaluation,
and data/AI processing. A modular monolith keeps transactions and authorization understandable while
preserving boundaries that can be extracted only after measured need.

**Alternatives considered**:

- A single Next.js application: rejected because untrusted document parsing and some AI/data libraries
  need a separate resource and security boundary.
- Domain microservices: rejected because the single-owner scale does not justify distributed
  transactions, duplicated authorization, or operational overhead.
- A separate general-purpose TypeScript API: deferred because Next.js supports the required BFF surface.

**Sources**: [Next.js BFF guidance](https://nextjs.org/docs/app/guides/backend-for-frontend),
[Vercel function limits](https://vercel.com/docs/functions/limitations).

## 2. Web Runtime and Framework Versions

**Decision**: Pin Node.js 24.x, Next.js 16.3.3 App Router, React and React DOM 19.2.8, and TypeScript
6.0.3 in strict mode. Use Server Components for server-owned reads, Server Actions for UI-scoped
mutations, and Route Handlers only for public APIs, callbacks, webhooks, streaming, and workflow entry
points. Use the Node runtime rather than Edge for BFF code.

**Rationale**: These versions are mutually compatible and current at the plan date. Next.js 16.3.3 is
the patched Active LTS line, Node 24 is the current Vercel default, and TypeScript 6 retains stable
compiler compatibility while the TypeScript 7 transition matures. Explicit authorization remains
mandatory in every action and route because all are independently reachable server entry points.

**Alternatives considered**:

- TypeScript 7: deferred until the Next.js compiler and monorepo ecosystem are unambiguously compatible.
- Edge runtime: rejected for database, package, and long-running task constraints.
- A separate API service: rejected at initial scale as unnecessary duplication.

**Sources**: [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation),
[Next.js releases](https://nextjs.org/blog),
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 3. UI System, Motion, and Accessibility

**Decision**: Use Tailwind CSS 4.3.3, checked-in shadcn/ui components from CLI 4.19.0, and Motion 13.1.1
from `motion/react`. Use CSS for simple transitions; isolate Motion behind client boundaries for the
career timeline and layout choreography. Configure user-respected reduced motion and lazy-load motion
features. Test all owned component source for WCAG 2.1 AA.

**Rationale**: This keeps design primitives application-owned, allows a distinctive one-page portfolio,
and controls client-side cost. The scroll-driven experience can remain progressive enhancement: a
semantic vertical timeline is always available, and animation never owns scrolling or meaning.

**Alternatives considered**:

- CSS-only motion: insufficient for the coordinated active-stage timeline, though preferred elsewhere.
- GSAP: rejected as extra capability and bundle weight without a demonstrated need.
- Tailwind 3.4: use only if browser analytics later require browsers below the v4 support floor.

**Sources**: [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide),
[shadcn Next.js setup](https://ui.shadcn.com/docs/installation/next),
[Motion accessibility](https://motion.dev/docs/react-accessibility),
[Motion bundle guidance](https://motion.dev/docs/react-reduce-bundle-size).

## 4. Monorepo and Dependency Management

**Decision**: Use pnpm 11.25.0 workspaces and Turborepo 2.10.6. Pin pnpm in `packageManager`, use
`workspace:*` for internal packages, and commit the lockfile. Manage the Python worker independently
with uv 0.7.19 and a committed `uv.lock`; Turbo may invoke Python lint and test targets.

**Rationale**: pnpm provides strict, space-efficient workspaces and Turbo supplies an explicit task
graph and caching across the planned packages. Python remains a real Python project rather than being
smuggled into JavaScript dependency semantics.

**Alternatives considered**:

- pnpm 12: deferred because its new Rust implementation had only just reached stable at the plan date.
- npm workspaces: workable but weaker for strict workspace linking and catalog control.
- Yarn or Bun: no project-specific advantage sufficient to add ecosystem risk.

**Sources**: [pnpm compatibility](https://pnpm.io/installation),
[pnpm workspaces](https://pnpm.io/workspaces),
[Turborepo releases](https://github.com/vercel/turborepo/releases),
[uv locking](https://docs.astral.sh/uv/concepts/projects/sync/).

## 5. System of Record, Authentication, and Storage

**Decision**: Use managed Supabase PostgreSQL 17 as the system of record, Supabase Auth with
cookie-based PKCE sessions, private Supabase Storage for evidence and generated artifacts, and public
Storage only for explicitly published sanitized media. Pin `@supabase/supabase-js` 2.112.4 and
`@supabase/ssr` 0.12.5, validating patch versions during implementation.

**Rationale**: One relational system supports domain integrity, full-text search, vector search,
transactions, audit history, and row-level authorization. Auth and object storage share the same owner
identity and policy model. Private originals never need public URLs.

**Alternatives considered**:

- Self-managed PostgreSQL and object storage: rejected for operational burden at single-owner scale.
- A document database: rejected because the workflows depend on relationships, constraints, versions,
  and state-transition history.
- Public buckets with unguessable paths: rejected because obscurity is not access control.

**Sources**: [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase Storage security](https://supabase.com/docs/guides/storage/security/access-control),
[Supabase platform upgrades](https://supabase.com/docs/guides/platform/upgrading).

## 6. Public/Private Publication Boundary

**Decision**: Enable default-deny RLS on every exposed table. Keep editable Career Brain data, evidence,
embeddings, drafts, audit records, and AI traces private. Publishing creates a versioned, allowlisted
Portfolio Publication snapshot and sanitized Portfolio Items. Anonymous users read only the published
projection through security-invoker views or narrowly scoped functions. Unpublishing removes public
reachability without changing source evidence.

**Rationale**: A derived publication snapshot prevents a permissive visibility flag from accidentally
exposing private columns, joins, chunks, or embeddings. Database policies protect the boundary even
when an application code path is missed. It also makes each public revision reproducible.

**Alternatives considered**:

- Application-only authorization: rejected because one missed route or direct data path can leak data.
- Anonymous read policies on private tables using `is_public`: rejected because private columns and joins
  remain too easy to expose.
- Service-role reads for normal owner requests: rejected because service credentials bypass RLS.

**Sources**: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api),
[PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html),
[Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## 7. Vector and Full-Text Retrieval

**Decision**: Enable pgvector 0.8.6, with environment validation requiring at least 0.8.4. Build two
authorization-filtered candidate channels: PostgreSQL full-text search using generated weighted
`tsvector` columns and GIN indexes, and cosine vector search. Start with exact vector search at small
corpus size; enable HNSW after measured latency justifies it. Fuse independent top-50 ranks using
Reciprocal Rank Fusion with initial constant 60, optionally rerank the top 20–30, and return 6–10
evidence chunks. Tune all numbers against evaluations.

**Rationale**: Lexical retrieval handles employers, acronyms, dates, skills, and exact technologies;
semantic retrieval handles paraphrases. Rank fusion avoids pretending their scores share a scale.
Authorization and visibility filters must be inside both candidate queries so forbidden chunks never
enter model context. Exact search avoids premature approximate-recall failures; HNSW is introduced with
recall monitoring and iterative scans for selective filters.

**Alternatives considered**:

- Vector-only retrieval: rejected for exact-name and citation-heavy career questions.
- Full-text-only retrieval: rejected for semantic paraphrases and transferable experience.
- External vector database: deferred until measured PostgreSQL limits justify duplicated storage and
  authorization complexity.
- Weighted score summation: rejected because heterogeneous score distributions require brittle tuning.

**Sources**: [pgvector hybrid-search guidance](https://github.com/pgvector/pgvector),
[PostgreSQL text search ranking](https://www.postgresql.org/docs/current/textsearch-controls.html),
[PostgreSQL text indexes](https://www.postgresql.org/docs/current/textsearch-indexes.html),
[original RRF research](https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/).

## 8. Evidence and Citation Provenance

**Decision**: Model immutable Evidence Sources, Source Versions, Chunks, Retrieval Runs, Generation Runs,
and Claim-Evidence Links using W3C PROV concepts. Store raw and normalized hashes, extractor and model
versions, exact source locations, visibility, trust, and owner-verification state. Give models opaque
evidence handles and deterministically reject citation handles that were not supplied in the generation
context. A citation always targets an immutable source version and location.

**Rationale**: This prevents model-fabricated citations and prevents later source edits from changing
what an old answer appeared to cite. Separating retrieval from generation provenance makes ranking,
grounding, and authorization failures reproducible.

**Alternatives considered**:

- URLs alone: rejected because content changes, disappears, or redirects.
- Source-level citations without offsets: rejected as too coarse for claim verification.
- Model-authored footnotes: rejected because the model can fabricate sources or identifiers.

**Sources**: [W3C PROV overview](https://www.w3.org/TR/prov-overview/),
[W3C PROV data model](https://www.w3.org/TR/prov-dm/),
[NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1).

## 9. Durable Workflow Orchestration

**Decision**: Use one Inngest app/environment with native TypeScript functions for product/provider
workflows and native Python functions for parsing and AI/data workflows. Trigger work through versioned
domain events and cron schedules. Put each retryable external side effect in a durable step. Pass record
IDs and private object references rather than large text or files.

**Rationale**: Inngest provides typed event and cron triggers, native TypeScript and Python functions,
persisted steps, step-level retries, resumability, concurrency controls, and run observability. It avoids
operating a separate queue, scheduler, result backend, and monitoring stack. Mixed-language workflows do
not require a custom protocol.

**Alternatives considered**:

- Trigger.dev: strong TypeScript-first durable execution, but Python work runs as child processes inside
  TypeScript tasks rather than native durable functions.
- Celery plus Redis: mature for Python, but adds queue, worker, Beat, locking, result storage, monitoring,
  and a custom TypeScript bridge.

**Safeguards**: Use app-owned workflow and audit tables, deterministic idempotency keys, database unique
constraints, an outbox for state-to-event handoff, payload-by-reference, per-provider concurrency and
throttles, explicit timeouts, and cooperative cancellation between steps.

**Sources**: [Inngest functions](https://www.inngest.com/docs/learn/inngest-functions),
[Python durable steps](https://www.inngest.com/docs/reference/python/steps/run),
[Inngest idempotency](https://www.inngest.com/docs/guides/handling-idempotency),
[Inngest limits](https://www.inngest.com/docs/usage-limits/inngest),
[Trigger.dev Python extension](https://trigger.dev/docs/config/extensions/pythonExtension),
[Celery tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html).

## 10. Google Drive Incremental Synchronization

**Decision**: Maintain a transactional change cursor for each connected Drive corpus. Bootstrap using a
start-page token, drain every page of the change log in order, commit document-change events through an
outbox, then atomically persist the new token. Use Drive change notifications only to wake a deduplicated
drain workflow and run periodic reconciliation because notification channels expire and can overlap.

For binary files, retain Drive identity/revision metadata plus a SHA-256 content hash. For Google-native
documents, export the approved representation and use its SHA-256 hash because editor revision entries
can merge. Treat removal, trash, or permission loss as a tombstone that immediately revokes retrieval
and publication eligibility without silently deleting reviewed history.

**Rationale**: This follows the official changes feed and prevents clock-window misses. Webhooks carry no
change body and are therefore wake-up hints, not the source of truth. Content hashing stops repeated
embedding of unchanged bytes.

**Alternatives considered**:

- Polling `modifiedTime`: rejected because it is prone to window errors and weaker for removal and
  sharing changes.
- Per-file watches: rejected because of channel overhead and the same empty notification bodies.

**Sources**: [Drive change tracking](https://developers.google.com/workspace/drive/api/guides/manage-changes),
[Drive push notifications](https://developers.google.com/workspace/drive/api/guides/push),
[Drive file metadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files),
[Drive export](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export).

## 11. Document Parsing Boundary

**Decision**: Preserve immutable source bytes in private object storage and parse allowlisted PDF, DOCX,
Markdown, and text in a dedicated non-root, no-egress, resource-limited Python container. Validate size,
extension, MIME, and magic bytes; scan or quarantine; enforce wall-clock, memory, page, archive-member,
decompressed-byte, and extracted-text limits. Use pypdf for digitally born PDFs, python-docx for DOCX,
and strict text decoding. Route only low-text PDF pages to separately bounded OCR. Preserve page,
paragraph, and character anchors.

**Rationale**: Untrusted documents can exploit parsers, exhaust memory, or contain indirect prompt
injection. Isolation limits the blast radius and exact anchors make evidence verifiable. Original bytes
and processing metadata remain immutable even when extraction improves.

**Alternatives considered**:

- Parsing in the web process: rejected as an unacceptable availability and security risk.
- A universal Apache Tika service immediately: deferred until broader format coverage justifies another
  runtime; Tika Pipes remains the preferred expansion path.
- OCR every PDF: rejected for cost, latency, and accuracy when text already exists.

**Sources**: [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
[pypdf extraction guidance](https://pypdf.readthedocs.io/en/stable/user/extract-text.html),
[Python ZIP security considerations](https://docs.python.org/3/library/zipfile.html),
[Apache Tika security model](https://tika.apache.org/security-model.html).

## 12. AI Provider Boundary and Configuration

**Decision**: Define application-owned capability ports for text generation, structured generation,
streaming, embeddings, reranking, and proposed tool calls. Provider adapters map canonical request,
response, error, usage, and capability types to vendor SDKs. The orchestrator owns budgets, timeout,
retry, fallback, and provider selection. Fallback is opt-in per workload and must not move private data
to an unapproved provider or region.

**Rationale**: Providers differ in streaming, schemas, tool semantics, refusals, token accounting, and
model lifecycle. A capability-aware boundary prevents vendor details from entering domain logic without
pretending every provider is identical.

**Alternatives considered**:

- Provider SDKs throughout domain code: rejected because policy and behavior would diverge.
- An “OpenAI-compatible” wire format as the domain model: rejected because similar shapes conceal
  material semantic differences.
- Lowest-common-denominator abstraction: rejected because structured output and safety metadata are
  required for reliable workflows.

**Sources**: [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/),
[JSON Schema 2020-12](https://json-schema.org/draft/2020-12).

## 13. Prompt Versioning and AI Evaluation

**Decision**: Store immutable prompt versions with content hashes, variable and response schemas,
author, rationale, and supersession links. Resolve environment aliases to immutable versions at run
time and record provider/model, retrieval configuration, tool schemas, application revision, and
evaluation release. Keep versioned human-labeled evaluation datasets in the repository with private
cases encrypted or generated. Gate releases on schema validity, grounded-claim rate, citation precision
and recall, abstention correctness, privacy/adversarial pass rate, task quality, latency, and cost.

**Rationale**: Exact prompt and retrieval provenance makes outputs reproducible and enables rollback.
Human-labeled regression cases reduce dependence on subjective model judges.

**Alternatives considered**:

- Source-code prompts without a runtime registry: insufficient for aliases and experiments.
- Mutable prompt rows: rejected because they destroy reproducibility.
- LLM judge as the sole gate: rejected because judges are biased and non-deterministic.
- MLflow as an immediate runtime dependency: deferred; its model is useful, but project-owned tables and
  evaluation artifacts meet initial needs with less infrastructure.

**Sources**: [MLflow Prompt Registry](https://mlflow.org/docs/latest/genai/prompt-registry/index.html),
[MLflow evaluation lifecycle](https://mlflow.org/docs/latest/genai/overview/),
[NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1).

## 14. Prompt Injection, Tools, and Unsafe Output

**Decision**: Treat user input, documents, web pages, job descriptions, retrieved chunks, memories, and
tool results as untrusted data. Models receive no arbitrary database, filesystem, shell, email, or
network tool. Every narrow tool proposal passes a deterministic gateway that rechecks identity, row
authorization, argument schema, resource scope, and action policy. Read-only tools are the default;
publication, communication, application, evidence changes, and other consequential actions require a
separate explicit owner confirmation. Validate structured output and sanitize rendered Markdown/HTML.

**Rationale**: Natural-language instructions are not an authorization boundary. Prompt-only defenses,
keyword filters, and second-model classifiers cannot guarantee privilege separation.

**Alternatives considered**:

- “Ignore malicious instructions” only: retained as guidance but rejected as enforcement.
- Regex or classifier as sole gate: rejected because attacks are unbounded and classifiers remain
  probabilistic.
- Autonomous general-purpose tools: rejected because the product does not require them.

**Sources**: [NIST indirect prompt injection](https://csrc.nist.gov/glossary/term/indirect_prompt_injection),
[OWASP improper output handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/),
[NCSC prompt-injection analysis](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection).

## 15. URL Fetching and SSRF Defense

**Decision**: Prefer uploads and configured adapters over arbitrary URL ingestion. When remote fetching
is required, use a dedicated low-privilege fetch boundary with no internal-network or secret access.
Allow HTTPS by default; normalize the URL; reject userinfo, unusual ports, non-global IPv4/IPv6 answers,
metadata ranges, and mixed public/private DNS sets; pin the validated address to the connection while
preserving hostname validation; and revalidate every bounded redirect. Apply egress firewall rules,
timeouts, size and decompression limits, content allowlists, and provenance logging without query strings
or credentials.

**Rationale**: String filters and one-time DNS validation are bypassable through alternative address
forms, redirects, and rebinding. Network-layer denial provides a second barrier when parsing fails.

**Alternatives considered**:

- Hostname denylist or URL regex: rejected as bypassable.
- Validation before only the first redirect: rejected because a later hop can target internal services.
- Headless-browser ingestion by default: rejected because it expands active-content and network risk.

**Sources**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html),
[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html),
[RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html).

## 16. Observability and Product Analytics

**Decision**: Instrument web, worker, workflows, retrieval, and AI using OpenTelemetry. Export through a
controlled Collector that allowlists, redacts, samples, and routes telemetry. Use Sentry for sanitized
errors and performance and PostHog for consented, allowlisted product events. Disable session replay on
sensitive authenticated workflows; if later enabled on public pages, mask all inputs, text, URLs, and
network payloads. AI spans contain identifiers, versions, token counts, latency, policy outcomes, and
citation counts—not prompts, responses, or evidence text by default.

**Rationale**: The Collector provides one enforceable privacy boundary and keeps vendors replaceable.
Explicit data allowlists prevent observability from becoming a second ungoverned career-data store.

**Alternatives considered**:

- Direct SDK-to-vendor export: rejected because it lacks a central redaction policy.
- Full prompt/response logging: rejected due to private evidence and breach impact.
- Plain hashed user IDs: rejected because small identifier spaces are enumerable; use keyed pseudonyms.

**Sources**: [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/),
[OpenTelemetry sensitive-data guidance](https://opentelemetry.io/docs/security/handling-sensitive-data/),
[PostHog replay privacy](https://posthog.com/docs/session-replay/privacy),
[Sentry JavaScript migration guidance](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md).

## 17. Deployment Topology

**Decision**: Deploy only `apps/web` to Vercel on Node 24 with preview deployments. Provision separate
preview and production Supabase projects in Frankfurt and place Vercel server functions in the matching
region. Deploy the Python Inngest worker as a non-root OCI container on a managed container service in
the same region, initially Google Cloud Run, with min/max instances, request and task timeouts, private
configuration, and no public business API beyond authenticated workflow serving and health checks.
Deploy an OpenTelemetry Collector alongside the worker or as a managed regional service. Use Inngest
Cloud initially with signed events and environment separation.

**Rationale**: This keeps request-bound web compute near the database, lets public static assets use the
global edge, and isolates untrusted/long-running work from Vercel limits. Preview infrastructure prevents
test data and callbacks from crossing into production.

**Alternatives considered**:

- Deploying the worker to Vercel: rejected because parsing and AI work are request-duration and bundle
  constrained.
- Self-hosting every component: rejected at initial scale due to operational load.
- Choosing the geographically nearest web region without a matching database region: rejected because
  database round trips dominate authenticated workflows. Kigali-to-Frankfurt latency must be measured.

**Sources**: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs),
[Vercel function regions](https://vercel.com/docs/functions/configuring-functions),
[Supabase regions](https://supabase.com/docs/guides/platform/regions),
[Cloud Run request timeouts](https://cloud.google.com/run/docs/configuring/request-timeout).

## 18. Python Runtime

**Decision**: Use standard-GIL CPython 3.13.5 with uv 0.7.19, `pyproject.toml`, a committed lockfile,
digest-pinned container base, non-root execution, read-only filesystem except bounded scratch space, and
explicit CPU/memory/time limits. Do not use free-threaded Python until all native dependencies certify
it.

**Rationale**: Python 3.13 is maintained and offers broader wheel compatibility for parsing and ML
dependencies than the newer 3.14 line. Deterministic locks and container digests make extraction and
evaluation reproducible.

**Alternatives considered**:

- Python 3.14: deferred pending dependency CI and native-wheel coverage.
- Free-threaded Python: deferred because native-extension compatibility is not yet a safe assumption.

**Sources**: [Python versions](https://www.python.org/doc/versions/),
[uv Python policy](https://docs.astral.sh/uv/reference/policies/python/),
[uv project synchronization](https://docs.astral.sh/uv/concepts/projects/sync/).

## 19. Generated CV and Cover-Letter Rendering

**Decision**: AI produces schema-validated `ResumeData` and `LetterData`, never layout instructions.
Versioned application-owned templates render HTML/CSS to PDF in a sandboxed browser process and render
DOCX through a deterministic document-generation library. The artifact pipeline records content,
template, renderer, fonts, evidence, and binary hashes. Final/submitted versions are immutable.

**Rationale**: Separating semantic content from layout makes artifacts editable, testable, accessible,
and reproducible. It prevents model output from injecting arbitrary markup or silently changing the
visual template.

**Alternatives considered**:

- Asking the model to emit PDF, DOCX, or free-form HTML: rejected as unsafe and non-reproducible.
- PDF-only output: rejected because the specification requires editable DOCX.
- Editing the final binary in place: rejected because it breaks version traceability.

**Sources**: [Playwright PDF contract](https://playwright.dev/docs/api/class-page#page-pdf),
[JSON Schema 2020-12](https://json-schema.org/draft/2020-12).

## 20. Testing Strategy

**Decision**: Use Vitest for TypeScript units and component logic, Testing Library for UI behavior,
Playwright plus axe checks for end-to-end and accessibility, pytest for Python units/integration, pgTAP
and database fixtures for constraints/RLS, contract tests for OpenAPI/events/provider adapters, and k6
for public/load goals. Maintain versioned AI evaluation datasets and adversarial privacy fixtures. Run
integration tests against disposable local or preview Supabase and Inngest environments, never shared
production data.

**Rationale**: Different risks need different evidence. Database denial tests prove the public/private
boundary, deterministic unit tests prove scoring and state machines, browser tests prove the one-page
experience, and AI evaluations prove grounding and abstention.

**Alternatives considered**:

- End-to-end tests only: rejected as slow and poor at locating domain failures.
- Unit tests only: rejected because RLS, workflows, providers, and rendering fail at boundaries.
- Production-data evaluation: rejected for privacy and reproducibility.

**Sources**: [Vitest](https://vitest.dev/guide/), [Playwright](https://playwright.dev/docs/intro),
[pytest](https://docs.pytest.org/), [pgTAP](https://pgtap.org/documentation.html),
[k6](https://grafana.com/docs/k6/latest/).

## Research Closure

All Technical Context choices are resolved; no planning unknowns remain. Version pins are planning
baselines and MUST be revalidated for security and compatibility during implementation without changing
the architectural decisions silently.
