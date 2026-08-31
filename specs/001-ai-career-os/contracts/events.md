# Durable Workflow Event Contract

**Transport**: Inngest events and cron triggers  
**Payload rule**: IDs and bounded metadata only; files, prompts, documents, and job descriptions travel by
private object/database reference

## Event Envelope v1

```json
{
  "name": "career/document.changed.v1",
  "id": "stable-producer-event-id",
  "ts": 1788177600000,
  "data": {
    "schemaVersion": 1,
    "ownerId": "uuid",
    "correlationId": "uuid-or-ulid",
    "causationId": "optional-event-id",
    "resourceType": "document",
    "resourceId": "uuid",
    "operationKey": "document:uuid:source-version",
    "requestedBy": "owner|schedule|provider|system",
    "metadata": {}
  }
}
```

### Envelope Rules

- Event name includes a major version. Consumers reject unknown major versions to a dead-letter path.
- `ownerId` is verified against the referenced resource before work; it is never trusted by itself.
- Producer event IDs provide transport-window deduplication; `operationKey` is enforced by durable
  database uniqueness for lifetime idempotency.
- `correlationId` links API request, outbox, event, workflow, steps, audit, and resulting artifacts.
- `metadata` is allowlisted per event and limited to 16 KiB. Raw external payloads use private objects.
- A transaction writes domain state and outbox row together. Dispatch acknowledges only after Inngest
  accepts the event; retries reuse the same event ID.

## Event Catalog

| Event | Producer | Consumer and terminal result |
|-------|----------|------------------------------|
| `career/drive.sync.requested.v1` | owner/schedule/webhook wake-up | TS coordinator drains changes and advances cursor transactionally |
| `career/document.changed.v1` | Drive drain/upload | Python ingestion creates immutable version or identifies unchanged hash |
| `career/document.removed.v1` | Drive drain | tombstones source and revokes retrieval/public eligibility |
| `career/document.parse.requested.v1` | ingestion coordinator | isolated parser stores normalized text/chunk anchors |
| `career/facts.extract.requested.v1` | parser | structured extractor creates review candidates only |
| `career/embeddings.requested.v1` | chunker/fact approval | compatible embeddings created/upserted by version |
| `career/fact.approved.v1` | owner review | refreshes indexes and marks projection preview stale |
| `career/portfolio.preview.requested.v1` | owner | builds staged allowlisted publication and validation report |
| `career/portfolio.published.v1` | owner confirmation | activates exact snapshot, invalidates public content cache |
| `career/portfolio.withdrawn.v1` | owner | removes public reachability and invalidates cache |
| `career/job-search.requested.v1` | owner/cron | fans out enabled sources under provider/user limits |
| `career/job-source.collect.requested.v1` | search coordinator | adapter results normalized and source run completed/failed |
| `career/job.discovered.v1` | source/manual entry | canonicalize, deduplicate, version JD, request analysis |
| `career/job.analyze.requested.v1` | job create/change | extracts requirements and computes evidence matches/scores |
| `career/application.artifact.requested.v1` | owner | composes, validates, renders, and versions selected artifact |
| `career/compensation.research.requested.v1` | owner | gathers lawful sources and produces dated recommendation |
| `career/interview-process.requested.v1` | owner/job transition | proposes evidence-based stages or records unknown status |
| `career/interview-kit.requested.v1` | owner/stage schedule | generates evidence-backed versioned preparation kit |
| `career/journal.insights.requested.v1` | owner | creates separate derived insights; never edits original |
| `career/post.assistance.requested.v1` | owner | creates private assisted draft/version only |
| `career/analytics.aggregate.requested.v1` | cron/backfill | rebuilds versioned private aggregates |
| `career/export.requested.v1` | owner | builds private portable export and expiring notification |

## Workflow Step Contract

Every step records:

```json
{
  "stepName": "parse-document",
  "stepVersion": 2,
  "operationKey": "parse:document-version-uuid:parser-v2",
  "inputRefs": [{ "type": "document_version", "id": "uuid", "hash": "sha256..." }],
  "outputRefs": [{ "type": "evidence_version", "id": "uuid", "hash": "sha256..." }],
  "timeoutSeconds": 900,
  "retryPolicy": { "maxAttempts": 4, "backoff": "exponential", "nonRetryableCodes": ["UNSAFE_FILE"] }
}
```

- A step rechecks current authorization/source state before external access and before commit.
- Side effects use `operationKey` and upsert/compare-and-set semantics.
- Retryable errors: timeout, transient network, provider 429/5xx, temporary lock, worker loss.
- Nonretryable errors: invalid schema, forbidden source, unsafe file, revoked connection, unsupported type,
  failed owner-policy check.
- Cancellation is checked between steps. Active parser/provider calls retain their own hard timeout.
- Partial workflows retain successful outputs and describe incomplete items; they never report complete.

## Schedules and Concurrency

- Cron schedules use the owner’s IANA timezone, an explicit logical run date, and jitter where supported.
- Unique purpose + target + logical date prevents overlapping duplicate scheduled work.
- Concurrency keys: owner for high-cost AI, connection for Drive drains, provider account for source rate
  limits, document version for parsing, job ID for analysis, artifact ID for rendering.
- Search fan-out failure is isolated per source; the coordinator produces `partial` when some sources fail.
- Webhook handlers validate provider channel/signature/state, enqueue a drain event, and acknowledge
  quickly. They never perform the actual synchronization inline.

## Payload Retention and Privacy

- Event/run metadata contains no document text, job description, prompt, answer, CV content, journal text,
  credentials, signed URLs, or raw provider response.
- Vendor trace retention is shorter than authoritative app run history. The app can reconstruct outcome
  and lineage from IDs/hashes after vendor trace expiry.
- Raw external data is encrypted in private storage and referenced by immutable hash under a retention
  class.

## Contract Tests

- Same event delivered twice creates one logical result.
- Crash after external call but before step completion does not duplicate the result.
- Cancelled workflows stop before the next step and retain truthful state.
- Revoked Drive permission between wake-up and fetch produces a tombstone/permission-lost result.
- One job source failure preserves successful source results and produces a partial run.
- Unknown major event versions dead-letter without mutation.
- Cross-owner or mismatched resource references fail before data access.
