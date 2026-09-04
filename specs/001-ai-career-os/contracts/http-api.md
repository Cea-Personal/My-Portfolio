# HTTP and Streaming API Contract

**Base path**: `/api/v1`  
**Media type**: `application/json` except uploads, downloads, and server-sent events  
**Error format**: RFC 9457 Problem Details

## Authentication Classes

| Class | Credential | Data boundary |
|-------|------------|---------------|
| Public read | none | active published portfolio snapshot only |
| Public AI | none + abuse controls | approved public evidence snapshot only |
| Owner | secure authenticated session + active configured-owner authorization | rows authorized to the sole owner subject by RLS |
| Provider callback | verified provider signature/state | one integration and callback purpose |
| Workflow | signed Inngest request + environment allowlist | declared event owner/resource only |

Every Server Action and Route Handler repeats authentication and authorization. Authenticated responses
are private/no-store. Public content may be cached by publication version; public AI responses are not
shared across request bodies or visitors.

A valid authenticated subject without active configured-owner authorization receives `FORBIDDEN`, is not
provisioned into `app.profiles`, and cannot create/read owner records. Owner bootstrap is an audited
deployment/recovery operation outside ordinary product APIs.

## Common Headers and Semantics

- `X-Correlation-ID`: accepted or generated; returned in responses and linked to runs/audit events.
- `Idempotency-Key`: required on retryable `POST` commands; 16–128 opaque characters.
- `If-Match`: required for mutable `PATCH`/transition commands, carrying the current revision token.
- `Last-Event-ID`: supported for reconnectable server-sent streams when the run remains active.
- Cursor pagination: `?cursor=<opaque>&limit=1..100`; responses contain `items` and `nextCursor`.
- List filters are allowlisted; arbitrary SQL/filter expressions are forbidden.

## Problem Details

```json
{
  "type": "https://career-os.example/problems/validation",
  "title": "Request validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "One or more fields are invalid.",
  "correlationId": "01...",
  "errors": [{ "path": "field", "code": "TOO_LONG" }]
}
```

Stable codes include `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `STALE_REVISION`,
`VALIDATION_FAILED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INSUFFICIENT_EVIDENCE`,
`UNSAFE_CONTENT`, `RUN_NOT_CANCELLABLE`, and `INTERNAL_ERROR`.

## Public Portfolio

### `GET /public/portfolio`

Returns the active immutable publication.

```json
{
  "publication": { "version": 7, "publishedAt": "2026-08-31T12:00:00Z", "contentHash": "sha256..." },
  "owner": { "displayName": "...", "headline": "...", "publicLinks": [] },
  "sections": [
    {
      "id": "experience",
      "items": [{ "publicId": "...", "title": "...", "summary": "...", "citations": ["PE-7"] }]
    }
  ]
}
```

The response schema allows Hero, About, Experience, Projects, Blog, and Let’s Talk content. Ask Basil is
an interactive shell bound to the returned publication version. Impact, metrics, professional projects,
skills, and tools are nested under their Experience stage. Portfolio as Proof is a Project item. It cannot
include internal IDs, confidence, private notes, source object keys, embeddings, restricted evidence
metadata, or frontend-authored fallback career claims.

Experience stages use ordered stable keys: `web_developer`, `software_engineer`,
`lead_software_engineer`, `data_engineer`, `senior_data_engineer`, and
`ai_engineer_software_data`. A stage includes its closed summary plus approved child collections for
work, professional projects, impacts/metrics, skills/tools, and case-study references. The final stage
declares whether it is a capability or an evidence-supported formal role.

When no active publication exists, the endpoint returns `200` with `publication: null`, empty career and
project content, approved non-career shell metadata only, and `state: "unpublished"`. It never fabricates
an owner headline, career stage, project, impact, skill, or metric.

### `GET /public/projects/{slug}`

Returns one published sanitized project case study from the active publication or `404`.

### `GET /public/posts/{slug}`

Returns one published article version and its classification as technical knowledge. Career claims expose
only approved public citations.

### `GET /public/evidence/{publicEvidenceId}`

Returns safe citation metadata and the exact approved excerpt from the active publication. It never
redirects to a private source object.

## Public AI Chat

### `POST /public/chat`

Request:

```json
{
  "question": "What production streaming experience is documented?",
  "publicationVersion": 7,
  "locale": "en"
}
```

Constraints: question 1–2,000 characters; no caller-provided filters, system instructions, tool list,
provider, or evidence IDs. Server hard-codes public scope.

Response: `text/event-stream` with ordered event types:

| Event | Required fields |
|-------|-----------------|
| `meta` | `runId`, publication version, started time |
| `citation` | opaque handle, public evidence ID, title, location, approved excerpt |
| `delta` | text fragment containing only declared citation handles |
| `complete` | final answer, claim support summary, usage class, completion time |
| `error` | stable code, safe detail, retryable flag |

The complete event is emitted only after deterministic citation-handle and claim-support validation. If
support is insufficient, it returns an abstaining answer with `INSUFFICIENT_EVIDENCE` semantics.

## Public Job-Description Match

### `POST /public/jd-matches`

Request:

```json
{
  "jobDescription": "...",
  "publicationVersion": 7,
  "locale": "en"
}
```

Constraints: 1–50,000 characters after normalization; external instructions are data. Response:

```json
{
  "analysisId": "...",
  "requirements": [
    {
      "id": "R1",
      "text": "Production Kafka experience",
      "priority": "required",
      "classification": "strong",
      "evidenceValue": "1.00",
      "weight": 3,
      "citations": ["PE-7"],
      "explanation": "..."
    }
  ],
  "score": { "value": "0.82", "formulaVersion": "jd-match/v1" },
  "limitations": []
}
```

Every requirement is searched independently. The server calculates the score; the explanatory model
cannot modify values, weights, or classifications after validation.

## Owner Profile and Dashboard

| Method and path | Purpose | Key result |
|-----------------|---------|------------|
| `GET /me` | Current private profile and connection summary | Profile revision, no secret values |
| `PATCH /me` | Update profile/preferences | Updated revision + audit event |
| `GET /dashboard` | Actionable private summary | Counts/links from authorized owner data |
| `GET /audit-events` | Cursor-paged audit history | Sanitized append-only events |
| `POST /exports` | Request portable export | Observable automation run; private download when ready |
| `GET /exports/{id}` | Inspect export status and expiry | Owner only; sanitized failure details |
| `GET /exports/{id}/download` | Download completed portable export | Authenticated stream or short-lived signed URL |

## Career Brain

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `GET /career/facts` | Filter and page facts | Filters: type, review, trust, visibility, subject |
| `POST /career/facts` | Create owner-verified manual fact | Defaults private; evidence metadata required |
| `GET /career/facts/{id}` | Fact, versions, evidence, review history | Owner only |
| `PATCH /career/facts/{id}` | Create corrected version | Requires `If-Match`; never mutates approved version |
| `POST /career/facts/{id}/review` | Approve, edit-and-approve, reject, defer | Explicit decision and optional reason |
| `GET|POST /career/experiences` | List/create experience | Structured record + controlling facts |
| `GET|PATCH /career/experiences/{id}` | Read/version an experience | Visibility changes audited |
| `GET|POST /career/projects` | List/create project | Confidential fields excluded from public contracts |
| `GET|PATCH /career/projects/{id}` | Read/version project/case study | Sanitization review on public change |
| `GET|POST /career/achievements` | List/create achievements and metrics | Metric context/evidence validation |
| `GET|POST /career/skills` | Canonical skills and aliases | Duplicate normalized names rejected |
| `GET /career/evidence/{id}` | Private source/version/chunk provenance | Signed object access is separately authorized |

## Document Connections and Ingestion

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `POST /integrations/drive/authorize` | Begin owner-approved OAuth connection | Returns provider authorization URL/state |
| `GET /integrations/drive/callback` | Complete verified callback | State and redirect allowlist required |
| `GET /integrations/drive` | Inspect connection, selected folder, sync cursor, scope, and revocation state | Never returns tokens or secrets |
| `DELETE /integrations/{id}` | Revoke connection | Does not silently delete verified facts |
| `GET /documents` | List source documents and status | No raw text in list response |
| `POST /documents/uploads` | Create bounded private upload | Returns one-time upload target and constraints |
| `POST /documents/uploads/{id}/complete` | Verify stored bytes and create immutable source version | Hash/signature/size checked before ingestion dispatch |
| `POST /documents/sync-runs` | Request Drive reconciliation or selected reprocess | Idempotent automation run |
| `GET /ingestion-runs/{id}` | Inspect run/items/retries/warnings | Sanitized errors only |
| `POST /ingestion-runs/{id}/cancel` | Cooperative cancellation | Fails if terminal/non-cancellable step |
| `GET /fact-reviews` | Pending extracted facts | Source excerpts only as owner-authorized evidence |

## Portfolio Projection

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `GET /portfolio/projection` | Draft projection rules and preview | Owner only |
| `PUT /portfolio/projection/{sourceType}/{sourceId}` | Upsert one rule | Validates source, visibility, confidentiality |
| `POST /portfolio/previews` | Build staged snapshot | Returns validation findings, never publishes |
| `POST /portfolio/publications` | Confirm and publish staged snapshot | Explicit owner confirmation + staged hash |
| `POST /portfolio/publications/{id}/withdraw` | Unpublish a version | Clears public reachability and caches |

Publishing rejects unsupported claims, private/restricted evidence, unsafe media/links, and confidential
fields. It never changes Career Brain trust or visibility automatically.

## Jobs and Search

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `GET|POST /job-sources` | List/create configurable source | Secret submitted once, stored by reference |
| `PATCH|DELETE /job-sources/{id}` | Update/disable/safely remove | Historical references retained |
| `POST /job-sources/{id}/tests` | Test connection and mapping | No enablement on failure |
| `GET|POST /search-profiles` | List/create profile | Includes criteria, weights, and schedule |
| `PATCH|DELETE /search-profiles/{id}` | Version or archive profile | Requires `If-Match` for PATCH; archived profiles cannot start new searches |
| `POST /job-search-runs` | Start one manual search | Returns observable run |
| `GET /job-search-runs/{id}` | Run/source outcomes | Partial success represented explicitly |
| `GET|POST /jobs` | Search jobs/create manual job | Pasted JD or an owner-supplied LinkedIn listing URL is retained as a private source reference; no LinkedIn scraping |
| `GET|PATCH /jobs/{id}` | Job workspace metadata | Canonical record + sources + versions |
| `POST /jobs/{id}/transitions` | Apply validated lifecycle transition | Append-only history |
| `GET /jobs/{id}/analysis` | Requirements, matches, scores | Calculation version and factors included |

## Applications and Artifacts

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `POST /jobs/{id}/applications` | Create application workspace | One active application/job by default |
| `GET|POST /application-profiles` | List/create reusable deterministic application profile | Only active owner profiles are returned; approved values are never rewritten by AI |
| `PATCH|DELETE /application-profiles/{id}` | Version or archive an application profile | Delete is an owner-scoped archive; selected application references are cleared |
| `GET /applications/{id}` | Complete workspace summary | Links to paged subresources |
| `POST /applications/{id}/transitions` | Update status | Does not imply external submission |
| `POST /applications/{id}/forms` | Save pasted/manual form | Remote analysis only through safe fetch policy |
| `GET|POST /applications/{id}/documents` | List or attach an owner-uploaded/linked application document | Private provenance and version metadata required |
| `DELETE /applications/{id}/documents/{documentId}` | Remove workspace association or private source where allowed | Generated artifacts and submitted snapshots are unaffected |
| `POST /application-fields/{id}/answer-drafts` | Draft evidence-backed answer | Never fills demographic fields |
| `POST /applications/{id}/artifacts` | Request CV/letter/answer set | Type + template + tone/length; async run |
| `GET /artifacts/{id}/versions` | Retrieve version history | Private signed downloads after auth |
| `POST /artifact-versions/{id}/review` | Mark reviewed/final/superseded | Requires exact content hash |
| `POST /artifact-versions/{id}/submitted-snapshot` | Record owner-submitted version | Records only; performs no submission |
| `POST /applications/{id}/packages` | Assemble selected immutable versions | Returns manifest/hash |

## Compensation, Journal, Interviews, and Content

| Method and path | Purpose |
|-----------------|---------|
| `POST /applications/{id}/compensation-research` | Start dated evidence-backed research |
| `GET /compensation-research/{id}` | Sources, assumptions, floor/target/stretch, confidence |
| `GET|POST /journal-entries` | List/create immutable owner journal entry |
| `POST /journal-entries/{id}/insight-runs` | Create separate derived insights |
| `GET|POST /applications/{id}/interview-process` | Read/create evidence-based or manual process |
| `POST /interview-processes/{id}/stages` | Add arbitrary stage |
| `POST /interview-stages/{id}/transitions` | Schedule/complete/cancel/skip with history |
| `POST /interview-stages/{id}/preparation-kits` | Generate stage-specific versioned kit |
| `POST /interview-processes/{id}/auto-prepare` | Generate or refresh every stage's private interview package from the selected job, JD, approved evidence, CV context, and prior stories | Confidence labels and evidence gaps are explicit; no live assistance |
| `GET|POST /star-stories` | Manage evidence-backed reusable stories |
| `POST /interview-stages/{id}/mock-interviews` | Start private practice session only |
| `POST /mock-interviews/{id}/complete` | Store qualitative feedback and derived insights |
| `GET|POST /posts` | List/create private draft |
| `PATCH /posts/{id}` | Create edited version |
| `POST /posts/{id}/schedule` | Explicitly schedule approved version |
| `POST /posts/{id}/publish` | Explicit owner publication confirmation |
| `POST /posts/{id}/archive` | Archive public content and refresh projection |

No endpoint exists for joining meetings, live interview assistance, sending recruiter communication,
or submitting applications/forms.

## Analytics and Automation

| Method and path | Purpose | Notes |
|-----------------|---------|-------|
| `POST /public/analytics/events` | Accept allowlisted consented public event | No arbitrary properties/free text |
| `GET /analytics/portfolio` | Private engagement aggregates | Minimum cohort/privacy thresholds |
| `GET /analytics/applications` | Funnel/time metrics with allowlisted filters | Reproducible calculation version |
| `GET /analytics/interviews` | Topic/strength/gap summaries | Qualitative caveats included |
| `GET /analytics/career-gaps` | Market demand vs documented evidence | Never equates missing evidence with absent skill |
| `GET|POST /automations` | List/create safe schedules | Allowed purpose enum excludes consequential action |
| `PATCH /automations/{id}` | Enable/disable/version schedule | Requires `If-Match` |
| `GET /automation-runs/{id}` | Inspect steps, attempts, status, error | No sensitive payload text |
| `POST /automation-runs/{id}/cancel` | Cooperative cancellation | Idempotent |
| `POST /automation-runs/{id}/retry` | Retry an eligible failed/partial run | Uses retained task configuration and a new attempt identity |
| `GET /settings/ai-capabilities` | List per-task effective AI settings and provider capabilities | Secret references are never returned |
| `PUT /settings/ai-capabilities/{taskType}` | Validate and version provider/model/creativity/length/timeout/retry/fallback settings | Rejects unavailable or policy-forbidden combinations |

## Downloads and Rendering

- Private source and artifact downloads use authenticated streaming or short-lived signed URLs generated
  after authorization. Signed URLs are never logged or returned to public clients.
- Public media is copied only as sanitized derivative objects referenced by an active publication.
- User-provided filenames are presentation metadata, not storage paths or response header values without
  encoding and sanitization.
- Generated PDF/DOCX responses include artifact version, content hash, template version, and safe filename
  in response metadata.

## Safe External Fetch

- Every server-initiated URL fetch uses the shared policy boundary: HTTPS only; DNS and resolved IP checks
  before the request and after every redirect; denial of loopback, private, link-local, and cloud metadata
  ranges; bounded redirects, time, bytes, and decompression; allowlisted response types; and sanitized
  errors. Job-source and application-form adapters may add stricter rules but cannot bypass this boundary.

## Contract Verification

- OpenAPI/route schemas and these tables are converted to executable schemas in implementation.
- Contract tests exercise success, validation, stale revision, duplicate idempotency key, unauthorized,
  cross-owner, public/private leakage, rate-limit, provider-failure, and cancellation cases.
- Database tests prove every anonymous and authenticated route uses only relations/policies appropriate to
  its authentication class.
