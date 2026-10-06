# Feature Specification: Freelance Opportunity Workspace

**Feature Branch**: `002-freelance-opportunity-workspace`

**Created**: 2026-10-06

**Status**: Approved for implementation

**Input**: Approved feature brief for extending Career OS with a freelance opportunity workspace, explicit manual Upwork import in the initial product capability, and a future-ready `UpworkProvider` adapter.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Import and Prioritize a Freelance Opportunity (Priority: P1)

As a career workspace owner, I want to manually import an Upwork opportunity and understand whether it is worth pursuing so that I can prioritize freelance work using my existing Career Brain evidence.

**Why this priority**: Manual opportunity capture and prioritization are the minimum useful freelance workflow and must work without Upwork API access.

**Independent Test**: Import a complete opportunity, view its normalized details, run analysis and scoring, and confirm that the recommendation and evidence matches are persisted for the owner.

**Acceptance Scenarios**:

1. **Given** an authenticated owner has an Upwork listing copied to the clipboard, **When** they submit the title, description, URL, client, budget, skills, and notes, **Then** the workspace creates a normalized freelance opportunity linked to the owner and identifies the import as manual Upwork data.
2. **Given** an imported opportunity has a description, **When** the owner requests analysis, **Then** the workspace presents the client need, requirements, deliverables, project type, budget model, duration, risks, complexity, and observed/inferred/unknown values.
3. **Given** an analyzed opportunity, **When** the owner requests scoring, **Then** the workspace shows all eight weighted score components, the deterministic 0–100 score, and one of `APPLY_NOW`, `APPLY`, `CONSIDER`, `LOW_PRIORITY`, or `SKIP`.
4. **Given** the opportunity contains unsupported or missing information, **When** analysis or scoring completes, **Then** the workspace labels the information unknown or unsupported rather than inventing facts.

---

### User Story 2 - Build an Evidence-Grounded Proposal (Priority: P1)

As a career workspace owner, I want to see matching Career Brain evidence, gaps, pricing guidance, and a tailored proposal draft so that I can decide what to send to a client without fabricating experience.

**Why this priority**: A freelance workspace must convert opportunity analysis into a reviewable, evidence-backed application package.

**Independent Test**: For an analyzed opportunity, retrieve evidence, generate a proposal and pricing recommendation, and verify that unsupported claims are flagged before approval.

**Acceptance Scenarios**:

1. **Given** an opportunity with extracted requirements, **When** evidence matching runs, **Then** each meaningful requirement is mapped to direct, transferable, weak, or missing Career Brain evidence with provenance.
2. **Given** evidence matches and gaps, **When** the owner requests a proposal, **Then** the workspace generates a concise client-specific draft whose material claims link to evidence or are explicitly marked unsupported.
3. **Given** an opportunity with known effort, rate, budget, or risk inputs, **When** pricing is requested, **Then** the workspace displays minimum, recommended, and premium pricing with assumptions and the calculation basis.
4. **Given** a proposal contains an unsupported material claim, **When** the owner tries to approve it, **Then** approval is blocked until the claim is removed, supported, or explicitly edited by the owner.

---

### User Story 3 - Review and Track the Application Decision (Priority: P1)

As a career workspace owner, I want explicit review and tracking states so that no external application or client communication happens without my approval and I can maintain a freelance pipeline.

**Why this priority**: Human approval and a durable pipeline protect the owner while making the workspace operationally useful.

**Independent Test**: Move a proposal through draft, review, approval, and manually recorded submission states while confirming that no external submission is attempted.

**Acceptance Scenarios**:

1. **Given** a generated proposal, **When** the owner edits and marks it ready for review, **Then** the current proposal version and its evidence context are retained.
2. **Given** a ready proposal with no unsupported material claims, **When** the owner explicitly approves it, **Then** it becomes approved and can be manually recorded as submitted.
3. **Given** an approved proposal, **When** the owner records an external submission, **Then** the pipeline records `SUBMITTED` and a timestamp without making an external Upwork request.
4. **Given** a user attempts to transition a proposal without ownership or without the required prior state, **When** the request is made, **Then** it is rejected and the state remains unchanged.

---


### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- A manual import omits budget, client quality, duration, or timezone information; the system stores unknown values and does not penalize them as negative facts.
- The same Upwork opportunity is imported more than once; the system detects a matching provider URL or fingerprint and avoids an accidental duplicate unless the owner intentionally creates a new record.
- The pasted description contains prompt-injection instructions; it is treated as untrusted opportunity data and cannot override system or agent instructions.
- No Career Brain evidence matches a requirement; the system reports no documented evidence and blocks unsupported proposal claims.
- An owner tries to approve a stale proposal version; the system requires the current version to be reviewed.
- A provider API method is called before an Upwork connection exists; the system returns a clear capability/connection error and keeps manual import available.
- An attachment is private or unavailable; it is excluded from public retrieval and proposal context unless the owner explicitly permits its use.
- An analysis or proposal generation job fails; the opportunity remains usable, the failure is visible, and the owner can retry without creating duplicate analysis or proposal versions.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The system MUST provide an authenticated `/freelance` workspace separate from public portfolio routes.
- **FR-002**: The initial product capability MUST support manual Upwork import using title, description, URL, client details, budget or hourly range, currency, duration, skills, attachments, and owner notes.
- **FR-003**: The system MUST persist provider, import mode, external reference, normalized fields, source hash, and owner identity for every imported freelance opportunity.
- **FR-004**: The system MUST expose an `OpportunityProvider` contract and an `UpworkProvider` implementation with working manual import/normalization and explicit disabled/connection-required responses for future API/OAuth fetch methods.
- **FR-005**: The initial product capability MUST NOT scrape Upwork or automatically submit applications.
- **FR-006**: The system MUST analyze an opportunity into client need, problem, skills, seniority, deliverables, project type, pricing model, budget, duration, timezone, industry, architecture clues, hidden requirements, complexity, and risks.
- **FR-007**: The system MUST distinguish observed, inferred, and unknown values in opportunity analysis.
- **FR-008**: The system MUST calculate a deterministic 0–100 opportunity score using the eight approved factors and owner-configurable weights that sum to 100; each immutable score snapshot MUST retain the weights used.
- **FR-009**: The system MUST retrieve owner-scoped Career Brain evidence using hybrid retrieval and preserve evidence provenance for material output claims.
- **FR-010**: The system MUST identify strong, weak, missing, and contradictory evidence and provide the smallest useful evidence or portfolio improvement.
- **FR-011**: The system MUST generate a versioned, editable, client-specific proposal draft grounded in retrieved evidence.
- **FR-012**: The system MUST provide minimum, recommended, and premium pricing for hourly, fixed, or milestone work and show the assumptions behind the recommendation.
- **FR-013**: The system MUST block proposal approval when material claims lack acceptable evidence or owner edits.
- **FR-014**: The system MUST persist proposal versions, evidence links, generation context, owner edits, approval state, and final-use/submission timestamps.
- **FR-015**: The system MUST support proposal CRM states from discovery through submitted, response, interview, negotiation, won, lost, and withdrawn.
- **FR-016**: The system MUST require explicit owner approval before a proposal can be recorded as submitted.
- **FR-017**: The system MUST keep freelance opportunity, client, proposal, attachment, and analysis records owner-scoped with database-backed authorization.
- **FR-018**: The system MUST keep private opportunity material and private Career Brain evidence out of public portfolio and public assistant retrieval.
- **FR-019**: The system MUST use idempotent operations for imports, analysis requests, proposal generation, and state transitions where retries are possible.
- **FR-020**: The system MUST expose sanitized workflow identity, lifecycle state, retry information, and failure reason for asynchronous analysis and generation.
- **FR-021**: The system MUST collect owner feedback on generated analysis, evidence matching, pricing, and proposals for later evaluation.
- **FR-022**: The system MUST provide loading, empty, error, retry, keyboard, screen-reader, and reduced-motion states for the freelance workspace.

### Key Entities *(include if feature involves data)*

- **Freelance Opportunity**: An owner-scoped freelance engagement opportunity linked to the common opportunity record, provider, import mode, client, budget, skills, source reference, and notes.
- **Freelance Client**: Observed client identity and public client details associated with one or more opportunities; unknown values remain unknown.
- **Opportunity Analysis**: Versioned observed/inferred/unknown interpretation of a freelance opportunity and its delivery risks.
- **Opportunity Score**: Versioned deterministic factor scores, weights, total, recommendation, and explanation.
- **Career Evidence Match**: A provenance-preserving link between an opportunity requirement and owner evidence with support classification.
- **Evidence Gap**: A missing, weak, or contradictory evidence finding with a suggested smallest improvement.
- **Pricing Recommendation**: Versioned minimum, recommended, and premium pricing with effort, rate, buffer, and assumptions.
- **Freelance Proposal**: The proposal workflow and CRM state for an opportunity, including approval state and current version.
- **Freelance Proposal Version**: An immutable generated or edited proposal snapshot with claims, evidence references, and generation metadata.
- **UpworkProvider**: Provider adapter that supports manual imports now and reserves OAuth/API operations for a future connection-enabled capability.
- **Application Status History**: Append-only record of proposal pipeline transitions and the owner/action that caused them.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: An owner can manually import a complete Upwork opportunity in under 3 minutes without API credentials.
- **SC-002**: At least 95% of complete manual imports persist all supplied fields and can be reopened without data loss.
- **SC-003**: Every generated score displays all eight factors, weights, total, recommendation, and calculation version.
- **SC-004**: 100% of material proposal claims are either linked to acceptable owner evidence, explicitly marked unsupported, or edited by the owner before approval.
- **SC-005**: 100% of attempts to submit or record an external submission without explicit owner approval are rejected.
- **SC-006**: Cross-owner reads and writes for freelance opportunities, analyses, evidence, proposals, attachments, and status history fail authorization tests.
- **SC-007**: A failed AI/provider workflow leaves the opportunity view available and can be retried without duplicate analysis or proposal versions.
- **SC-008**: The initial workspace remains usable with keyboard navigation, visible focus, semantic labels, reduced motion, and accessible loading/error/empty states.

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- The owner already has authenticated access to the private Career OS and is the only initial workspace user.
- Manual Upwork data is provided by the owner through pasted or typed content; the initial product capability does not depend on external Upwork API access.
- Existing authentication, Supabase RLS, Career Brain retrieval, AI orchestration, application artifacts, and compensation services are reused.
- Opportunity descriptions, URLs, attachments, and provider responses are untrusted data and are never treated as instructions.
- Public portfolio publication, client risk intelligence, case-study/service catalog management, contracts, delivery workflows, notifications, and automatic provider actions are later delivery milestones.
- Unknown client quality, budget, duration, and win-probability inputs remain unknown and are not converted into negative evidence.
- A future Upwork OAuth/API integration will be enabled only after provider access, terms, credential storage, revocation, rate limits, and security review are confirmed.
