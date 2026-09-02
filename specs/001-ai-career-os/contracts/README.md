# Interface Contracts

These contracts define the boundaries that implementation tasks must preserve.

| Contract | Purpose |
|----------|---------|
| [HTTP and streaming API](http-api.md) | Public portfolio/AI and authenticated owner operations |
| [Workflow events](events.md) | Versioned Inngest event envelope, catalog, and idempotency semantics |
| [AI and evidence](ai-contracts.md) | Provider-neutral AI ports, retrieval, claims, citations, and generated artifact schemas |
| [Job source adapter](job-source-adapter.md) | Pluggable job discovery, fetch, normalize, and health contract |
| [Portfolio experience](portfolio-experience.md) | Reconciled one-page composition, career chapters, hero, project, Ask Basil, and responsive acceptance contract |

## Global Rules

- Every contract is versioned independently and changed compatibly or with a new major version.
- Public contracts contain only allowlisted published data. Private identifiers are never accepted as a
  shortcut to public access.
- Authenticated contracts derive `owner_id` from a verified session with active configured-owner
  authorization, never from client input. Authentication without owner authorization is forbidden.
- Every write supports a correlation ID; retryable creates require an idempotency key.
- All timestamps use RFC 3339 UTC strings; monetary values use decimal strings plus ISO currency.
- Unknown fields are rejected for security-sensitive commands and ignored only for explicitly extensible
  provider metadata.
- Errors use stable machine codes and sanitized human-readable detail. Raw provider/parser/model errors
  remain private.
- Consequential actions require a distinct confirmation command; draft-generation requests can never
  publish, submit, send, or mutate verified evidence.
- Contract fixtures cover allow and deny paths and are shared by TypeScript, Python, and database tests.

## Contract Change Policy

1. Additive optional fields are minor changes.
2. New required fields, renamed values, changed scoring semantics, or removed fields require a major
   contract version and a migration period.
3. Event producers publish one version; consumers declare accepted versions and dead-letter unknown
   major versions without guessing.
4. Prompt, schema, scoring, adapter, and rendering versions are persisted with their outputs.
5. Published snapshots and submitted artifacts retain the exact contract/schema version used.
