# AI, Retrieval, Evidence, and Generated Artifact Contracts

## Provider-Neutral Ports

```text
TextGenerator.generate(request) -> GenerationResult
TextGenerator.stream(request) -> AsyncStream<GenerationEvent>
StructuredGenerator.generate(request, responseSchema) -> ValidatedObject
EmbeddingProvider.embed(batch, modelConfig) -> EmbeddingBatch
Reranker.rank(query, candidates, modelConfig) -> RankedCandidate[]
ToolProposalModel.propose(request, allowedToolSchemas) -> ToolProposal[]
```

Provider adapters MUST report capabilities and map to canonical types. The orchestrator owns retry,
timeout, fallback, budgets, policy, and provider choice. A capability downgrade fails closed unless the
workload explicitly permits it. Provider-specific options live in a namespaced adapter field and cannot
enter domain services.

Canonical errors: `authentication`, `rate_limit`, `timeout`, `refusal`, `invalid_output`, `context_limit`,
`provider_unavailable`, `policy_denial`, and `cancelled`.

## Retrieval Query v1

```json
{
  "queryId": "uuid",
  "ownerScope": "owner-uuid-or-publication-id",
  "visibility": ["public"],
  "query": "production streaming experience",
  "filters": {
    "organizations": [],
    "roles": [],
    "projects": [],
    "careerStages": [],
    "skills": ["Kafka"],
    "dateRange": null,
    "trustAtLeast": "ai_extracted_reviewed",
    "evidenceTypes": []
  },
  "configurationVersion": "hybrid-v1",
  "limits": { "lexical": 50, "semantic": 50, "rerank": 25, "context": 8 }
}
```

Rules:

- Public callers cannot set `ownerScope`, visibility, trust, source IDs, or provider; the server derives
  them from the active publication contract.
- Authorization/deletion filters are applied inside both lexical and vector candidate queries.
- Ranks and scores remain separate: lexical rank/score, vector rank/distance, RRF rank/score, reranker
  rank/score, final rank.
- Fallback from reranking records the degraded configuration and never broadens visibility.

## Evidence Handle v1

```json
{
  "handle": "E7",
  "chunkId": "private-immutable-uuid",
  "publicEvidenceId": "PE-7-or-null",
  "sourceVersionHash": "sha256...",
  "title": "Approved safe title",
  "location": { "page": 3, "section": "Impact", "charStart": 121, "charEnd": 248 },
  "excerpt": "Exact bounded supporting excerpt",
  "supportClass": "direct",
  "visibility": "public"
}
```

The model receives only opaque handles and approved excerpts. Display metadata comes from server-owned
records, never model output. Public responses expose only `publicEvidenceId` and safe fields.

## Supported Claim v1

```json
{
  "claimId": "C1",
  "text": "The owner designed a production streaming ingestion layer.",
  "outputStart": 0,
  "outputEnd": 60,
  "support": "supported",
  "evidenceHandles": ["E7"],
  "attribution": "designed",
  "confidence": "high"
}
```

Allowed support values: `supported`, `qualified`, `inference`, `unsupported`, `conflicting`. Material
career claims marked unsupported are removed or replaced with explicit insufficiency. Unknown handles,
wrong offsets, unavailable source versions, or visibility mismatches fail deterministic validation.

## Public Answer v1

```json
{
  "answer": "... [E7]",
  "claims": [],
  "citations": [],
  "evidenceStatus": "sufficient|partial|insufficient|conflicting",
  "limitations": [],
  "generation": {
    "runId": "public-opaque-id",
    "publicationVersion": 7,
    "promptVersion": "portfolio-chat/3",
    "schemaVersion": 1
  }
}
```

Public generation has no write-capable tools and no access to private source rows. Exact prompt/model
details remain private operational metadata.

The public UI presents this contract as the portfolio-question mode of Ask Basil. The “How do I fit?”
mode uses the Job Description Analysis and deterministic scoring contracts below. Sharing a section does
not merge their schemas: conversational claims require citation validation, while the displayed role-fit
score is copied from the immutable deterministic calculation and cannot be rewritten by the model.

## Job Description Analysis v1

```json
{
  "jobDescriptionHash": "sha256...",
  "requirements": [
    {
      "id": "R1",
      "text": "Production Kafka experience",
      "priority": "required",
      "category": "technology_experience",
      "skills": ["Kafka"],
      "confidence": 0.94
    }
  ],
  "schemaVersion": 1,
  "extractorVersion": "jd-requirements/2"
}
```

For each requirement, a distinct Retrieval Query is executed. Match values are fixed:

| Classification | Evidence value |
|----------------|----------------|
| Strong Match / direct | 1.00 |
| Strong transferable | 0.75 |
| Related Match | 0.50 |
| Partial/weak | 0.25 |
| No Evidence | 0.00 |

Weights are required 3, preferred 2, optional 1. Overall score is:

```text
sum(evidence_value × requirement_weight) / sum(requirement_weight)
```

The scoring service validates every input classification, calculates decimal output, records formula
version and factors, then gives the immutable result to the explanation model.

## Extracted Career Fact v1

```json
{
  "factType": "achievement",
  "statement": "Reduced onboarding time by 60%.",
  "subjectCandidate": { "type": "project", "externalKey": "..." },
  "structuredValue": { "metric": "60", "unit": "percent", "direction": "decrease" },
  "sourceSpans": [{ "handle": "E1", "start": 10, "end": 47 }],
  "modelConfidence": 0.91,
  "suggestedTrust": "ai_extracted",
  "requiresOwnerReview": true
}
```

Extraction cannot assign `approved`, `owner_verified`, `public`, or projection eligibility. Schema
validation, evidence-span validation, and owner review are separate deterministic steps.

## ResumeData v1

```json
{
  "identity": { "name": "...", "headline": "...", "links": [] },
  "summary": { "text": "...", "claimIds": ["C1"] },
  "experiences": [
    {
      "role": "...",
      "organization": "...",
      "dates": { "start": "YYYY-MM", "end": "YYYY-MM-or-present" },
      "bullets": [{ "text": "...", "claimIds": ["C2"], "evidenceHandles": ["E4"] }]
    }
  ],
  "projects": [],
  "skills": [],
  "education": [],
  "certifications": [],
  "targetJobDescriptionVersionId": "uuid",
  "schemaVersion": 1
}
```

The schema forbids HTML, CSS, URLs outside approved profile links, unknown sections, or arbitrary layout
directives. Templates decide layout. Every material bullet references validated claims/evidence.

## LetterData v1

Contains recipient/company/job metadata, owner-approved greeting/signoff, two to four `connections`, and
ordered paragraphs. Each connection contains business need, evidence-backed experience, impact, why it
matters, claim IDs, and evidence handles. Tone and maximum length are enum/numeric inputs, not free-form
system instructions.

## Tool Proposal and Policy Gateway

```json
{
  "proposalId": "uuid",
  "tool": "career.read_public_evidence",
  "arguments": { "queryId": "uuid" },
  "requestedScope": "public-read",
  "reason": "Retrieve evidence for the visitor's question"
}
```

Allowed tools map to narrow service methods. The policy gateway independently validates current actor,
resource, row policy, schema, action class, rate/budget, and confirmation token. There are no general SQL,
shell, filesystem, arbitrary fetch, email, publication, or application-submission tools.

## Prompt and Evaluation Contract

Every AI run resolves and records:

- prompt name, immutable version, and content hash;
- input/output JSON Schema versions;
- configured and actual provider/model plus approved data region;
- embedding/reranker and retrieval configuration versions;
- tool schema/policy version;
- application revision, evaluation release, token/latency/cost metadata;
- content capture policy (`metadata_only` by default).

Promotion gates include schema-valid rate, grounded-claim rate, citation precision/recall, abstention,
privacy/adversarial cases, task-specific human scores, latency, and cost. A failed required gate prevents
alias promotion and leaves the previous immutable version active.

## Adapter Contract Tests

Every provider adapter runs the same fixtures for structured output, streaming cancellation, refusal,
rate limit, timeout, context limit, malformed output, usage reporting, tool proposal, model-name response,
and capability downgrade. Private-data fallback to another provider/region is denied unless that exact
path is pre-approved.
