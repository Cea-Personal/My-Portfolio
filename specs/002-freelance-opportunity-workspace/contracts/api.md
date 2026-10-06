# Freelance API Contract

All mutation endpoints require the existing private API authentication, same-origin, JSON, idempotency-key, and owner-scoped authorization rules. `PATCH`/`PUT` mutations require `If-Match` as defined by the existing private API guard.

## Opportunities

### `GET /api/v1/freelance/opportunities`

Returns owner-scoped opportunities with current score, recommendation, proposal status, and latest analysis summary.

### `POST /api/v1/freelance/opportunities`

Creates a manual opportunity. Required: `provider`, `title`, and non-empty `description`. Optional: `url`, `client`, `budget`, `hourlyRange`, `currency`, `duration`, `timezone`, `skills`, `attachments`, and `notes`.

For the initial capability, `provider: "upwork"` and `importMode: "manual"` are accepted. The endpoint stores the URL as an owner-supplied reference and does not fetch it.

Successful response: `201` with `{ opportunity }`.

Errors include:

- `400 INVALID_FREELANCE_OPPORTUNITY`
- `409 DUPLICATE_FREELANCE_OPPORTUNITY`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

### `GET /api/v1/freelance/opportunities/{id}`

Returns the opportunity aggregate and owner-scoped related analysis, score, evidence, pricing, proposal, and timeline data.

### `PATCH /api/v1/freelance/opportunities/{id}`

Updates owner-editable fields using optimistic concurrency. It never changes verified Career Brain facts or immutable analysis/proposal versions.

## Intelligence actions

### `POST /api/v1/freelance/opportunities/{id}/analyze`

Queues or runs an idempotent analysis request. Returns an execution identity and current state. Opportunity text is passed as untrusted data and may not provide instructions.

### `POST /api/v1/freelance/opportunities/{id}/score`

Computes and persists the deterministic eight-factor score from the current analysis and evidence state. Returns all factor values, weights, total, recommendation, and calculation version.

### `GET /api/v1/freelance/opportunities/{id}/evidence`

Returns requirement matches, provenance, support classifications, and evidence gaps. Results are private and owner-scoped.

### `GET|POST /api/v1/freelance/opportunities/{id}/pricing`

Returns or creates a pricing recommendation. The server validates and recomputes arithmetic; AI-generated assumptions must be labeled and are not authoritative inputs without owner review.

## Proposals

### `GET|POST /api/v1/freelance/opportunities/{id}/proposal`

Returns the current proposal or requests an evidence-grounded draft. Draft creation persists a new immutable version and its claim/evidence references.

### `POST /api/v1/freelance/proposals/{id}/versions`

Creates an owner-edited proposal version from the current version. Stale versions are rejected.

### `POST /api/v1/freelance/proposals/{id}/transitions`

Applies one valid CRM or approval transition and appends status history. Invalid transitions return `409 INVALID_STATE_TRANSITION`.

### `POST /api/v1/freelance/proposals/{id}/approve`

Approves the current reviewed version only when no material unsupported claims remain and the owner explicitly confirms the action.

### `POST /api/v1/freelance/proposals/{id}/record-submission`

Records a manually completed external submission only after approval. It does not call Upwork or any provider.

## Analytics

### `GET /api/v1/freelance/analytics`

Returns deterministic counts and funnel metrics for owner opportunities, recommendations, proposal states, approval states, submissions, wins/losses, and known/unknown data coverage.

## Provider contract

```ts
interface OpportunityProvider {
  readonly provider: string;
  readonly version: string;
  readonly capabilities: readonly (
    | "manual_import"
    | "oauth"
    | "api_fetch"
    | "api_submit"
  )[];

  importManual(input: ManualOpportunityInput): NormalizedFreelanceOpportunity;
  fetchOpportunities(context: ProviderContext): Promise<ProviderResult>;
  getOpportunity(externalId: string, context: ProviderContext): Promise<ProviderResult>;
  normalize(record: unknown): NormalizedFreelanceOpportunity;
}
```

`UpworkProvider` advertises `manual_import` in the initial capability. `fetchOpportunities` and `getOpportunity` return `UPWORK_CONNECTION_REQUIRED` or `PROVIDER_CAPABILITY_DISABLED` until a reviewed OAuth/API connection is enabled. `api_submit` is not advertised in the initial capability.
