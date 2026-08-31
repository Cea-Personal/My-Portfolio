<!--
Sync Impact Report
- Version change: template (unratified) -> 1.0.0
- Modified principles: none; this is the initial constitution.
- Added principles:
  - I. Career Brain Is Canonical
  - II. Evidence-Grounded AI
  - III. Impact-First Representation
  - IV. Owner-Controlled Career Truth
  - V. Privacy by Default
  - VI. Human Approval for Consequential Actions
  - VII. Deterministic Logic Before AI
  - VIII. Modular Provider Architecture
  - IX. Secure External-Data Handling
  - X. Observable and Resilient Automation
  - XI. Testable AI Behavior
  - XII. No Fabricated Professional Claims
  - XIII. Public/Private Boundary Enforcement
  - XIV. Accurate Contribution Attribution
  - XV. Confidential Employer Information Protection
  - XVI. Versioned and Traceable Generated Artifacts
  - XVII. Accessible, Performance-Conscious UX
  - XVIII. Incremental Specification-Driven Development
- Added sections: Product and Architecture Constraints; Development Workflow and Quality Gates.
- Removed sections: none; template placeholders were replaced.
- Follow-up TODOs: none.
-->
# AI Career OS Constitution

## Core Principles

### I. Career Brain Is Canonical
The Career Brain MUST be the canonical source of professional truth for every public and private
feature. Documents, manual owner input, and reviewed extractions MUST flow through structured
Career Brain records and their evidence before use. Portfolio views, matching, generated documents,
interview preparation, analytics, and content MUST NOT maintain divergent hard-coded career facts.
Public presentation MUST consume an explicit Portfolio Projection rather than raw Career Brain data.
This prevents contradictory claims and makes corrections propagate predictably.

### II. Evidence-Grounded AI
Every material AI statement about employment, roles, dates, responsibilities, technologies, skills,
projects, leadership, education, certifications, achievements, metrics, or impact MUST be supported
by retrievable evidence. Each output MUST preserve sufficient provenance to identify the source and
verification state. When evidence is missing, weak, or conflicting, the system MUST say so and MUST
NOT fill the gap with inference presented as fact. Retrieval MUST apply authorization and visibility
filters before generation.

### III. Impact-First Representation
Professional experience MUST be presented in this priority order when evidence permits: quantified
impact, achievement, action, technology, then business context. Metrics MUST be reproduced only from
verified evidence and MUST retain their context. Technology lists alone MUST NOT substitute for an
account of contribution or outcome. This keeps the portfolio and application materials truthful and
useful to hiring decision-makers.

### IV. Owner-Controlled Career Truth
Manual owner-verified facts MUST be accepted as first-class knowledge with provenance and timestamps.
Significant AI-extracted or AI-inferred facts MUST enter an explicit review state and MUST NOT become
verified or publicly eligible without owner approval. Editing, rejection, trust level, and visibility
MUST be independently recorded. AI processing MUST NOT overwrite source documents, original journal
entries, or previously verified evidence.

### V. Privacy by Default
Career data MUST default to non-public visibility unless the owner explicitly approves publication.
Appropriate records MUST support public, private, and restricted classifications. Data collection,
retention, analytics, and logs MUST be limited to what is necessary for a documented product purpose.
Sensitive content MUST NOT be included in telemetry, prompts, or model context unless required,
authorized, and protected. Privacy controls MUST fail closed.

### VI. Human Approval for Consequential Actions
The system MUST require explicit owner approval before it submits a job application or form, sends a
recruiter communication, publishes content or career facts, submits compensation expectations, or
changes verified evidence. AI MAY draft, analyze, and recommend, but the owner MUST make the final
decision. Automatic job-application submission and live or hidden interview assistance are prohibited
in the current product scope.

### VII. Deterministic Logic Before AI
Authentication, authorization, CRUD, state transitions, scoring arithmetic, deduplication, scheduling,
validation, rendering, field mapping, permissions, and analytics aggregation MUST use deterministic
services. Agents MAY be used only where semantic interpretation or reasoning materially improves the
result. An LLM MAY explain a deterministic score but MUST NOT invent or silently alter it. Simple
operations MUST NOT be wrapped in agents merely for architectural appearance.

### VIII. Modular Provider Architecture
External job sources, AI models, embedding models, rerankers, storage, and background execution MUST
be accessed through documented interfaces that isolate provider-specific behavior. Configurable
providers MUST keep credentials server-side and MUST support validation, timeouts, retries, and failure
reporting appropriate to their risk. Core domain workflows MUST NOT depend irreversibly on one AI or job
data provider. New services or abstractions MUST have a demonstrated domain or operational need.

### IX. Secure External-Data Handling
Uploaded files, retrieved documents, job descriptions, job pages, forms, web content, and external API
responses MUST be treated as untrusted data, never as executable instructions. Implementations MUST
enforce authentication, authorization, input and file validation, safe parsing, sanitization, rate
limits, server-side secret handling, SSRF defenses, prompt-injection defenses, and audit logging where
applicable. External content MUST NOT override system prompts, permissions, visibility rules, or tool
authority.

### X. Observable and Resilient Automation
Every asynchronous or scheduled workflow MUST expose an execution identity, lifecycle state, start and
completion times, relevant entity links, retry history, and a sanitized failure reason. Operations MUST
be idempotent where repetition is possible and MUST define retry and partial-failure behavior. Failure
of one provider or AI service MUST degrade only dependent capabilities; the portfolio and verified
Career Brain MUST remain usable. Logs MUST be structured and MUST avoid unnecessary sensitive text.

### XI. Testable AI Behavior
AI features MUST have explicit, measurable evaluation criteria covering grounding, provenance,
retrieval quality, hallucination, visibility enforcement, extraction quality, and task-specific output
quality. Critical deterministic calculations and permission boundaries MUST be tested independently of
the model. AI tests MUST include insufficient-evidence, conflicting-evidence, malicious-input, provider
failure, and private-data leakage cases. Prompt and model changes MUST be evaluated before release.

### XII. No Fabricated Professional Claims
The system MUST NOT manufacture, embellish, or imply unsupported professional experience, skills,
ownership, results, credentials, interview history, or compensation evidence. AI inference MUST be
labeled distinctly from verified knowledge and MUST never automatically become career truth. Absence
of documented evidence MUST be reported as “no evidence documented,” not as proof that the owner lacks
a skill. This rule is non-negotiable and overrides stylistic or conversion goals.

### XIII. Public/Private Boundary Enforcement
Public interfaces and public AI MUST retrieve only approved public projection data and public evidence.
Private and restricted records MUST be protected at the query, service, and database authorization
layers; filtering solely in the client or final prompt is insufficient. Every new query, tool, agent,
export, analytics event, and cache MUST be reviewed for boundary enforcement. Tests MUST prove that
cross-boundary access fails closed.

### XIV. Accurate Contribution Attribution
Every project description MUST distinguish the owner’s actual contribution from team or organizational
work using evidence-backed language such as designed, built, led, co-built, contributed, maintained,
migrated, optimized, or architected. The system MUST NOT imply sole ownership unless evidence supports
it. Collaborative context MUST be preserved in public pages, AI answers, CVs, cover letters, and
interview materials.

### XV. Confidential Employer Information Protection
Professional work MAY be represented without repository or source-system access, but public outputs
MUST use an owner-approved, sanitized description. Proprietary code, confidential schemas, credentials,
customer data, private APIs, internal infrastructure details, trade secrets, and confidential documents
MUST NOT be disclosed. Conceptual diagrams MAY communicate architecture only after confidential names
and implementation details have been removed. Confidentiality restrictions override completeness.

### XVI. Versioned and Traceable Generated Artifacts
Generated CVs, cover letters, application answers, application packages, interview kits, and published
content MUST be versioned. Each version MUST record its relevant job or purpose, input context, evidence,
generation time, model and prompt version when AI is used, template, owner edits, and final-use status
as applicable. Final submitted or published artifacts MUST remain reproducible and retrievable without
being silently replaced by later generations.

### XVII. Accessible, Performance-Conscious UX
Public and private experiences MUST target WCAG 2.1 AA and MUST support semantic markup, keyboard use,
visible focus, screen readers, sufficient contrast, reduced motion, and accessible forms and dialogs.
Essential meaning and actions MUST NOT depend only on color, motion, hover, or a pointer device. The public
portfolio MUST remain responsive and usable when AI or integrations fail. Performance budgets and
measured regressions MUST be addressed in each feature plan, especially for the one-page portfolio and
scroll-driven timeline.

### XVIII. Incremental Specification-Driven Development
Work MUST follow Constitution -> Specification -> Plan -> Tasks -> Implementation -> Tests -> Review.
Implementation MUST NOT begin until the relevant requirements, acceptance criteria, architecture,
dependencies, security implications, and executable tasks have been reviewed. Each task MUST trace to
requirements and have independently verifiable completion criteria where practical. Codex and other
engineering agents MUST operate on bounded approved tasks; production deployment and merge MUST remain
subject to human review.

## Product and Architecture Constraints

- The product MUST preserve three explicit domains: the public portfolio, the canonical Career Brain,
  and the authenticated private Career OS. Shared capabilities MUST respect domain boundaries.
- The primary public portfolio MUST remain a cohesive, one-page scrolling experience. Dedicated detail
  routes MAY exist for content such as articles and project case studies.
- PostgreSQL MUST be the system of record unless a reviewed plan amends this constitution. Vector search
  MUST complement, not replace, structured data, full-text search, metadata filters, and provenance.
- Retrieval MUST be hybrid where career evidence is required and MUST preserve citations. Job-description
  matching MUST evaluate meaningful requirements independently and calculate scores deterministically.
- Authentication and authorization MUST protect all private Career OS capabilities. Secrets MUST remain
  server-side, and row-level database controls MUST be used where they materially strengthen isolation.
- Integrations MUST respect provider terms, technical access restrictions, rate limits, and deletion or
  revocation semantics. Unchanged source documents MUST NOT be repeatedly processed or embedded.
- The architecture MUST prefer clear domain modules and the fewest deployable services that meet the
  requirements. Python workers MAY be used where document, data, or AI processing clearly benefits.
- The system MUST continue to function without Codex at runtime. Codex is a development aid operating
  through reviewed Spec Kit artifacts, not a production dependency.

## Development Workflow and Quality Gates

1. Every feature specification MUST define actors, testable requirements, acceptance criteria, data and
   state transitions, privacy and security rules, failure cases, and applicable AI behavior.
2. Every implementation plan MUST document architectural trade-offs, public/private data flow,
   authorization, observability, failure isolation, migrations, rollout, and recovery where applicable.
3. Every task MUST reference its requirements, dependencies, likely modules, completion criteria, and
   verification method. Vague tasks such as “build AI” are prohibited.
4. Applicable changes MUST include unit, integration, end-to-end, security, accessibility, performance,
   and AI-evaluation coverage in proportion to risk. Tests MUST cover loading, empty, error, and retry
   states where users can encounter them.
5. Schema changes MUST include reviewed migrations, constraints, indexes, audit timestamps, and rollback
   or forward-recovery guidance. Authorization changes MUST include negative access tests.
6. AI changes MUST document the model/provider abstraction, prompt version, evidence contract, tool
   permissions, fallback behavior, latency and cost observability, and evaluation results.
7. A feature is complete only when its acceptance criteria pass and its implementation, tests,
   authorization, failure states, responsive and accessible UX, observability, security review, and
   documentation are complete where applicable.
8. Reviewers MUST record any justified constitutional exception in the plan before implementation. The
   exception MUST state its scope, risk, mitigation, owner, and expiry or amendment path.

## Governance

This constitution is the highest-authority project governance document. Specifications, plans, tasks,
code, tests, documentation, and operating procedures MUST comply with it. Where another artifact
conflicts with this constitution, the constitution governs until it is formally amended.

Amendments MUST be proposed as an explicit constitution change with rationale, affected principles,
migration or remediation impact, and approval from the project owner. The amended constitution MUST
include an updated Sync Impact Report and date. Dependent specifications and plans MUST be reviewed for
necessary follow-up, but this workflow changes only the constitution itself.

Versions follow semantic versioning: MAJOR for incompatible governance changes, removals, or principle
redefinitions; MINOR for new principles or materially expanded obligations; PATCH for clarifications
that do not alter obligations. Initial ratification is version 1.0.0.

Every specification and implementation plan MUST include a Constitution Check before work begins.
Every pull request or equivalent review MUST verify traceability, evidence and privacy boundaries,
human-approval controls, tests, security, observability, and any documented exceptions. Compliance MUST
be re-reviewed before release and whenever a material architecture, provider, data-flow, or AI behavior
change is proposed.

**Version**: 1.0.0 | **Ratified**: 2026-08-31 | **Last Amended**: 2026-08-31
