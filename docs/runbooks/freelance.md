# Freelance workspace runbook

## Current capability

- Import Upwork opportunities manually from `/freelance`; URLs are stored as owner-provided references and are not fetched or scraped.
- The domain adapter is `UpworkProvider`. Manual normalization works; API fetch methods return explicit connection/capability errors until OAuth/API integration is implemented and reviewed.
- Opportunity analysis and proposal drafting use the existing private AI harness and owner-scoped Career Brain retrieval. Listing facts require exact excerpts; missing owner evidence is reported as missing, not as proof of missing experience.
- Analysis is currently started from the opportunity page and runs in the request; durable background analysis status, retry metadata, and automatic analysis-on-import are not implemented yet.
- Score and pricing calculations are deterministic. Score weights are owner-configurable and must total 100. Score snapshots keep the weights used at calculation time.
- Proposal versions must be owner-edited and marked ready for review before approval. Recording submission only updates Career OS; it does not contact Upwork.

## Basic workflow

1. Sign in and open `/freelance`.
2. Paste the title, description, and optional Upwork URL/client/budget/skills. Import creates a private owner-scoped record and does not fetch the URL.
3. Open the opportunity and run analysis, then calculate a score. Review unknown factors and evidence matches before deciding.
4. Add a pricing estimate using an explicit effort estimate and target effective hourly rate; review the saved assumptions.
5. Generate a proposal, inspect every claim and its Career Brain evidence, edit the text, and mark the reviewed version ready.
6. Approve explicitly. After submitting externally yourself, use “I submitted this manually” to record that fact. Update later CRM status from the opportunity view.

## Current limitations

OAuth/API ingestion, automatic URL extraction, attachments, client-risk intelligence, portfolio case-study selection, interview/scope preparation, contract/project conversion, delivery assistance, and full revenue/performance analytics are not implemented in this delivery. Do not treat an absent client or evidence field as negative information. The approval and submission endpoints do not send external messages or applications.

## Validation status

The feature's unit/API/database/browser validation suite is not complete. Do not infer successful end-to-end or database validation from the presence of this runbook. Use the repository task list to track the remaining validation work.
