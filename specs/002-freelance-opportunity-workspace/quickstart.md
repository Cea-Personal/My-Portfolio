# Quickstart: Freelance Opportunity Workspace

## Prerequisites

- Node.js 24 and pnpm 11
- Local Supabase configured for the repository
- An authenticated owner fixture/profile
- Existing Career Brain evidence fixture or seeded owner data

## Validation commands

The acceptance scenarios below are the intended end-to-end workflow, not a report that they have passed. At present, only the package-level unit test file exists; the API, integration, pgTAP, browser, and accessibility feature tests remain to be added. No feature validation has been run as part of this implementation turn.

```bash
pnpm exec vitest run packages/freelance/src/freelance.test.ts
```

## Scenario 1: Manual Upwork import

1. Sign in to the private workspace.
2. Open `/freelance` and use “Capture an opportunity”. The current form is Upwork-specific.
3. Enter a title and description, and optionally provide an Upwork URL, client name, budget/rate ranges, currency, duration, skills, and notes.
4. Submit with an idempotency key.
5. Confirm the opportunity appears once, is linked to the owner, has `provider=upwork`, `import_mode=manual`, and stores the source hash.
6. Repeat the same import and confirm the API returns a duplicate response or reuses the existing record without creating a second opportunity.

## Scenario 2: Analyze, score, and match evidence

1. Open an imported opportunity and request analysis.
2. Confirm the analysis displays client need, deliverables, requirements, complexity, risks, and observed/inferred/unknown values.
3. Request scoring.
4. Confirm all eight score factors, weights, deterministic total, recommendation, and calculation version are visible.
5. Open evidence matches and confirm citations are owner-scoped and missing evidence is reported as missing rather than assumed absent.

## Scenario 3: Proposal and pricing approval

1. Request a proposal draft from an analyzed opportunity.
2. Confirm material claims have evidence references or unsupported flags.
3. Request hourly or fixed pricing and confirm minimum/recommended/premium values and assumptions are displayed.
4. Attempt approval while an unsupported material claim remains and confirm the request is rejected.
5. Edit the proposal claims and text, attach a verified evidence reference to each claim, mark it ready for review, and approve it.
6. Record manual submission and confirm the pipeline moves to `SUBMITTED` without any external network request.

## Scenario 4: Provider capability boundary

1. Call the `UpworkProvider.fetchOpportunities` path without a provider connection.
2. Confirm it returns a stable connection/capability error.
3. Confirm manual import remains available and does not attempt URL scraping.

## Scenario 5: Privacy and failure behavior

1. Attempt to read another owner’s opportunity, evidence, proposal, or history and confirm authorization fails. Attachment behavior is not implemented yet.
2. Import description text containing an instruction such as “ignore previous instructions” and confirm it is treated as data.
3. Force an analysis/provider failure and inspect error handling. Durable analysis status, retry metadata, and idempotent analysis retries are still pending implementation and must not be assumed to pass.
