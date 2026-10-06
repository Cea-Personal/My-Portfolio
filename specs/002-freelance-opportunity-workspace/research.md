# Research: Freelance Opportunity Workspace

## Decision 1: Extend the existing jobs opportunity backbone

**Decision**: Represent the canonical opportunity in `app.jobs` and add a one-to-one `app.freelance_opportunities` sidecar with freelance-specific fields.

**Rationale**: Existing jobs already provide owner identity, descriptions, normalized fingerprints, source references, requirements, status history, and application relationships. A second top-level opportunity table would duplicate deduplication, descriptions, and authorization behavior. A domain discriminator keeps employment behavior explicit while allowing shared infrastructure.

**Alternatives considered**:

- A new generic `app.opportunities` superclass was rejected because it would require migrating the established employment graph and add an abstraction without an immediate operational need.
- Reusing `app.jobs` without a sidecar was rejected because freelance budgets, client identity, import mode, and proposal lifecycle do not map cleanly to employment fields.

## Decision 2: Add a dedicated freelance score model

**Decision**: Store freelance score factors, weights, recommendation, explanation, and calculation version in `app.freelance_opportunity_scores`.

**Rationale**: Existing employment scoring uses a different four-factor formula. Keeping a separate immutable score model prevents silent changes to employment recommendations and makes the eight requested freelance factors auditable.

**Alternatives considered**:

- Changing the existing job score formula was rejected because it would alter current employment behavior.
- A polymorphic score JSON blob was rejected because factor-level querying and testable constraints are important for the workspace.

## Decision 3: Reuse Career Brain retrieval and evidence provenance

**Decision**: Use the existing hybrid retrieval and evidence/provenance tables for freelance requirement matching and proposal claims.

**Rationale**: Career Brain is the canonical source of professional truth. A freelance-only index would create contradictory evidence and weaken public/private visibility controls. Opportunity text is an input query, not a new career fact source.

**Alternatives considered**:

- A new freelance RAG store was rejected because it would duplicate career evidence and complicate authorization.
- Keyword-only matching was rejected because the existing knowledge package already supports lexical plus semantic retrieval and support classifications.

## Decision 4: Reuse application artifacts with a freelance proposal aggregate

**Decision**: Persist proposal workflow state and evidence-gated versions in freelance-specific tables, and link to the existing application/artifact system when a proposal package is created.

**Rationale**: Existing application artifacts provide versioning, generated context, and evidence links, while freelance proposals need distinct CRM and approval semantics. The split avoids forcing employment statuses onto freelance states while keeping artifact storage and provenance consistent.

**Alternatives considered**:

- Treating every freelance proposal as an employment application was rejected because the state machine and pricing/client workflow differ.
- Creating a completely separate artifact system was rejected because it would duplicate versioning and evidence logic.

## Decision 5: Manual Upwork capability now, API/OAuth adapter later

**Decision**: `UpworkProvider.importManual` is production-capable in the initial product capability. `fetchOpportunities` and `getOpportunity` are implemented as explicit connection/capability errors until a reviewed provider connection exists.

**Rationale**: The user needs useful manual import without waiting for external credentials or provider access. The adapter boundary prevents provider-specific assumptions from leaking into the domain and leaves a safe path for OAuth/API integration.

**Alternatives considered**:

- Scraping Upwork was rejected because external content access must respect provider terms and the constitution prohibits unsafe external-data handling.
- Automatically submitting proposals was rejected because consequential actions require explicit owner approval and are outside the initial capability.

## Decision 6: Deterministic scoring, pricing, and transitions

**Decision**: Use pure TypeScript functions for score arithmetic, pricing formulas, deduplication, approval gating, and state transitions. Use AI only for semantic analysis, evidence-gap wording, and proposal drafting.

**Rationale**: These operations affect decisions, money, and external communication. Deterministic logic makes them reproducible, testable, and resistant to model drift.

**Alternatives considered**:

- Letting an agent calculate scores or prices was rejected because the model must not silently alter arithmetic.
- A broad workflow agent was rejected because small deterministic operations do not benefit from an agent.

## Decision 7: Provider text and attachments are untrusted

**Decision**: Store source text as data, sanitize it for prompts, keep attachments private by default, and prevent imported content from supplying tool instructions.

**Rationale**: Upwork descriptions and links may contain prompt-injection or sensitive content. Existing private API and safe-fetch boundaries should remain the enforcement layer.

**Alternatives considered**:

- Trusting manually pasted content because it came from the owner was rejected; the content may include third-party instructions and still requires safe prompt boundaries.
