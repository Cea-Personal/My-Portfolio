# Data Model: Freelance Opportunity Workspace

## Existing entities extended

### `app.jobs`

Add a domain discriminator with default `employment` and preserve all current employment semantics.

- `opportunity_domain`: `employment | freelance`, default `employment`
- Existing `owner_id`, title, description, source URL/provider, normalized fingerprint, and timestamps remain authoritative for the canonical opportunity identity.
- A freelance opportunity must have `opportunity_domain = freelance`.

### `app.applications`

Add an application kind or equivalent discriminator with default `employment` so a freelance proposal can reuse application artifacts without changing employment statuses.

## New entities

### `app.freelance_clients`

Represents observed client identity, not an inferred quality judgment.

- `id` UUID primary key
- `owner_id` UUID, required, references `app.profiles`
- `provider` text, initially `upwork`
- `external_id` text, nullable
- `display_name` text, nullable
- `profile_url` text, nullable and owner-supplied
- `country`, `timezone`, `industry` text, nullable
- `observed_attributes` JSONB, default `{}`
- `unknown_attributes` text[], default `{}`
- `created_at`, `updated_at`
- Unique owner/provider/external identity when external identity is present

### `app.freelance_opportunities`

One-to-one freelance-specific aggregate linked to `app.jobs`.

- `id` UUID primary key
- `owner_id` UUID, required
- `job_id` UUID, required, unique, references `app.jobs`
- `provider` text, initially `upwork`
- `import_mode` text: `manual | url_reference | api`
- `provider_external_id` text, nullable
- `client_id` UUID, nullable, references `app.freelance_clients`
- `budget_type` text: `hourly | fixed | milestone | unknown`
- `budget_min`, `budget_max`, `hourly_min`, `hourly_max` numeric, nullable
- `currency` text, nullable
- `estimated_duration` text, nullable
- `timezone_requirements` text, nullable
- `skills` text[], default `{}`
- `service_tags` text[], default `{}`
- `owner_notes` text, nullable
- `source_hash` text, required
- `created_at`, `updated_at`
- Unique owner/provider/provider_external_id when the external id is present

### `app.freelance_opportunity_analyses`

Versioned semantic analysis. Each row is immutable.

- `id` UUID primary key
- `owner_id`, `opportunity_id`
- `version` integer and unique opportunity/version
- `description_id` UUID, nullable, references `app.job_descriptions`
- `client_need`, `problem_summary`, `deliverables`, `project_type`, `seniority`, `industry` JSONB/text fields
- `pricing_model`, `duration`, `timezone`, `architecture_clues`, `hidden_requirements` JSONB/text fields
- `complexity`, `risks` JSONB/text fields
- `observed`, `inferred`, `unknown` JSONB, default `{}`
- `agent_run_id`, `prompt_version`, `model_version`, `content_hash`
- `created_at`

### `app.freelance_opportunity_scores`

Immutable deterministic score snapshot.

- `id` UUID primary key
- `owner_id`, `opportunity_id`, `analysis_id`
- Factor numeric values from 0–100: `technical_fit`, `evidence_strength`, `budget_economics`, `win_probability`, `client_quality`, `strategic_value`, `scope_clarity`, `delivery_risk`
- `weights` JSONB containing the weights used for this snapshot (default configuration: 25/15/15/15/10/10/5/5)
- `app.freelance_score_configurations` stores owner-specific configurable weights (all eight factors, non-negative, total 100); each score snapshot retains its own applied weights
- `total_score` numeric constrained between 0 and 100
- `recommendation` enum/text: `APPLY_NOW | APPLY | CONSIDER | LOW_PRIORITY | SKIP`
- `explanation` JSONB
- `calculation_version`, `created_at`

### `app.freelance_evidence_matches`

Owner-scoped link between an extracted requirement and existing Career Brain evidence.

- `id` UUID primary key
- `owner_id`, `opportunity_id`
- `requirement_id` nullable, references existing job requirement if reused
- `evidence_handle`/source reference fields compatible with existing knowledge provenance
- `support_class`: `direct | transferable | related | weak | contradictory | missing`
- `confidence`, `reason`, `citation` JSONB/text
- `is_approved_for_proposal` boolean default false
- `created_at`

### `app.freelance_evidence_gaps`

- `id`, `owner_id`, `opportunity_id`
- `requirement_text`
- `gap_type`: `missing | weak | contradictory | unavailable`
- `smallest_improvement`
- `severity`
- `created_at`

### `app.freelance_pricing_recommendations`

Immutable pricing snapshot.

- `id`, `owner_id`, `opportunity_id`, nullable `analysis_id`
- `currency`, `pricing_mode`
- `estimated_hours`, `target_effective_rate`, `risk_buffer_percent`
- `minimum_amount`, `recommended_amount`, `premium_amount`
- `assumptions`, `evidence_snapshot`, `calculation_version`
- `created_at`

### `app.freelance_proposals`

Workflow aggregate for the opportunity.

- `id`, `owner_id`, `opportunity_id`
- Nullable `application_id` and `application_package_id` links to existing application/artifact infrastructure
- `crm_status`: `DISCOVERED | QUALIFIED | PROPOSAL_DRAFTED | READY_FOR_REVIEW | SUBMITTED | VIEWED | CLIENT_RESPONDED | INTERVIEW | NEGOTIATION | WON | LOST | WITHDRAWN`
- `approval_state`: `DRAFT | READY_FOR_REVIEW | APPROVED | SUBMITTED | DECLINED`
- `current_version_id`, nullable `pricing_recommendation_id`
- `owner_notes`, `approved_at`, `submitted_at`, `closed_at`
- `revision`, `created_at`, `updated_at`

### `app.freelance_proposal_versions`

Immutable proposal snapshots.

- `id`, `owner_id`, `proposal_id`, `version`
- Structured proposal content and rendered body
- `claim_refs`, `evidence_refs`, `unsupported_claims` JSONB
- `source`: `generated | owner_edited | imported`
- `agent_run_id`, `prompt_version`, `model_version`, `owner_edits`, `content_hash`
- `reviewed_at`, `approved_at`, `created_at`

### `app.freelance_proposal_status_history`

Append-only pipeline audit trail.

- `id`, `owner_id`, `proposal_id`
- `from_status`, `to_status`, `from_approval_state`, `to_approval_state`
- `actor_id`, `reason`, `transitioned_at`

### `app.freelance_attachments`

Private opportunity attachments and references.

- `id`, `owner_id`, `opportunity_id`
- `private_object_key`, `original_filename`, `media_type`, `byte_size`, `content_hash`
- `availability`, `visibility`, `provenance`, `created_at`, `removed_at`

### `app.freelance_agent_feedback`

Owner feedback for evaluation and later learning.

- `id`, `owner_id`, `opportunity_id`, nullable `proposal_version_id`
- `agent_task`, `rating`, `feedback`, `labels`, `created_at`

## Relationships

```text
jobs (freelance domain)
  └── freelance_opportunities ── freelance_clients
          ├── analyses
          ├── scores
          ├── evidence_matches ── Career Brain evidence handles
          ├── evidence_gaps
          ├── pricing_recommendations
          ├── attachments
          └── freelance_proposals
                  ├── proposal_versions
                  ├── status_history
                  └── existing applications/artifacts
```

## State transitions

### Proposal CRM status

```text
DISCOVERED → QUALIFIED → PROPOSAL_DRAFTED → READY_FOR_REVIEW → SUBMITTED
SUBMITTED → VIEWED → CLIENT_RESPONDED → INTERVIEW → NEGOTIATION → WON
SUBMITTED → LOST | WITHDRAWN
```

Transitions are deterministic, owner-scoped, append-only in history, and reject invalid prior states.

### Approval state

```text
DRAFT → READY_FOR_REVIEW → APPROVED → SUBMITTED
READY_FOR_REVIEW → DRAFT | DECLINED
APPROVED → DECLINED
```

`SUBMITTED` requires `APPROVED` and an explicit owner action. There is no provider submission operation in the initial capability.

## Validation and privacy rules

- All owner IDs must match the authenticated owner and RLS policy.
- `total_score` and pricing values are validated server-side and recomputed from inputs.
- Negative score meanings are not assigned to unknown data; unknown values remain explicit.
- Proposal approval fails when material claims are unsupported or when the approved version is stale.
- Provider URLs are stored as references; no arbitrary page is fetched from a manual import.
- Attachments and opportunity text are private by default and excluded from public projection/retrieval.
- Deletion or removal marks source availability without deleting immutable proposal or audit history unless a reviewed retention policy requires it.
- Every versioned/generated table stores content hash and generation metadata needed for reproducibility.
