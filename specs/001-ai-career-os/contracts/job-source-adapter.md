# Job Source Adapter Contract

## Purpose

Job providers vary in authentication, query semantics, pagination, fields, rate limits, and terms. This
contract keeps provider behavior outside canonical job, matching, scoring, and lifecycle services.

## Adapter Interface v1

```text
capabilities(context) -> JobSourceCapabilities
testConnection(configRef, context) -> ConnectionTestResult
search(query, cursor, context) -> JobSearchPage
fetchJob(externalIdOrUrl, context) -> RawJobRecord
normalize(rawRecord, mappingVersion, context) -> NormalizedJobCandidate
healthCheck(context) -> HealthResult
```

Adapters do not persist canonical jobs, compute match/opportunity scores, publish data, submit
applications, or choose retries. The workflow coordinator owns those responsibilities.

## Adapter Context

```json
{
  "sourceId": "uuid",
  "ownerId": "uuid",
  "correlationId": "uuid",
  "configVersion": 3,
  "secretRef": "secret-manager-reference",
  "deadline": "2026-08-31T12:01:00Z",
  "allowedHosts": ["api.provider.example"],
  "rateBudget": { "remaining": 100, "resetAt": "..." }
}
```

The coordinator resolves the secret only inside the server/worker boundary and supplies a credential
handle where possible. Logs and errors never contain credentials, headers, query strings, or raw job text.

## Search Query

```json
{
  "titles": ["Senior Data Engineer"],
  "titleSynonyms": ["Data Platform Engineer"],
  "seniority": ["senior", "lead"],
  "locations": [{ "country": "DE", "city": null }],
  "workArrangements": ["remote", "hybrid"],
  "employmentTypes": ["permanent"],
  "keywords": ["Kafka", "Databricks"],
  "excludedKeywords": [],
  "postedAfter": "2026-08-24T00:00:00Z",
  "pageSize": 50
}
```

Adapters map supported filters and return ignored/approximated filters explicitly. They never silently
claim exact filtering when the provider cannot support it.

## Search Page

```json
{
  "records": [],
  "nextCursor": "opaque-or-null",
  "providerRequestId": "safe-id-or-null",
  "rateLimit": { "remaining": 94, "resetAt": "..." },
  "filterCoverage": [
    { "filter": "titles", "mode": "exact" },
    { "filter": "keywords", "mode": "post_filter" }
  ]
}
```

Provider cursors are opaque and private. A workflow checkpoints each page only after candidate records and
the next cursor are durably committed.

## Raw Job Record

Raw records are private, bounded, and versioned by content hash. Required adapter metadata:

- provider and adapter version;
- external ID and canonical source URL where available;
- observed/fetched time and provider modification/revision marker;
- response media type and content hash;
- terms/retention classification;
- original payload object reference, not inline event content.

Unsafe markup and external instructions remain untrusted data.

## Normalized Job Candidate v1

```json
{
  "externalId": "provider-job-id",
  "sourceUrl": "https://...",
  "company": { "name": "...", "externalId": "..." },
  "title": "Senior Data Engineer",
  "description": "normalized plain text",
  "location": { "display": "Berlin, Germany", "country": "DE", "city": "Berlin" },
  "workArrangement": "remote|hybrid|onsite|unknown",
  "employmentType": "permanent|contract|temporary|internship|unknown",
  "contractType": "employee|b2b|freelance|unknown",
  "compensation": {
    "minimum": "80000.00",
    "maximum": "100000.00",
    "currency": "EUR",
    "period": "annual",
    "sourceText": "approved bounded excerpt"
  },
  "postedAt": "RFC3339-or-null",
  "expiresAt": "RFC3339-or-null",
  "providerStatus": "open|closed|unknown",
  "normalizationWarnings": [],
  "mappingVersion": "provider/v3"
}
```

Description text is required for acceptance into the downstream pipeline; title and company may be
temporarily unknown for manual pasted-description jobs. Currency/period never default silently.

## Connection Test Result

```json
{
  "status": "success|authorization_failed|configuration_error|rate_limited|unavailable",
  "capabilities": {
    "search": true,
    "fetchById": true,
    "incrementalCursor": true,
    "salary": false
  },
  "latencyMs": 142,
  "safeMessage": "Connection succeeded.",
  "testedAt": "..."
}
```

Only `success` can enable a source. A test reads the minimum record/metadata and does not create jobs.

## Health and Failure Semantics

Stable failure codes: `AUTH_FAILED`, `CONFIG_INVALID`, `RATE_LIMITED`, `TIMEOUT`, `UPSTREAM_4XX`,
`UPSTREAM_5XX`, `SCHEMA_CHANGED`, `TERMS_BLOCKED`, `UNSAFE_RESPONSE`, and `CANCELLED`.

- Retry transient timeout, rate limit with `Retry-After`, and upstream 5xx within workflow policy.
- Do not retry invalid credentials, terms denial, unsafe host/response, or schema validation without
  configuration/operator change.
- Circuit-break a failing source without stopping other sources.
- Persist partial source-run counts and safe diagnostics.

## Deduplication Handoff

The adapter supplies source identity and content; the canonical service calculates:

1. exact source key `(source_id, external_id)`;
2. canonical URL match;
3. company/title/location normalized key;
4. description fingerprint and similarity;
5. owner-review threshold for ambiguous merges.

The adapter cannot merge or overwrite canonical jobs. Every accepted reference retains first/last seen and
source status.

## Custom Source Safety

- Endpoint scheme/host/port passes the SSRF policy; redirects are revalidated.
- Secrets stay in the secret manager; field mappings are declarative and schema-validated.
- Custom adapters receive explicit rate limits, response size limits, timeout, allowed media types, and
  a test connection gate.
- Arbitrary executable code, shell commands, SQL, or model-generated adapters are not accepted through
  owner configuration.
- Provider terms and access notes are required before enablement.

## Contract Tests

- Pagination resumes without duplicate or missing accepted records.
- Rate limit and transient failure retries use the same operation key.
- Schema drift fails safely and retains the raw version for private diagnosis.
- Source failure does not affect another adapter or discard accepted results.
- Manual and automated candidates normalize to the same downstream schema.
- SSRF targets, oversized responses, unsafe markup, and credential leakage are rejected.
- Duplicate sources retain multiple references and do not create duplicate canonical jobs.
