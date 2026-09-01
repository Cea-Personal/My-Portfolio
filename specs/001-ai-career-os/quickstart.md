# Quickstart and End-to-End Validation Guide

**Purpose**: Prove the implemented AI Career OS satisfies the specification and architecture contracts.  
**Status**: Planning contract — commands become executable as implementation tasks create the workspace.

## Prerequisites

- Node.js 24.x with Corepack
- pnpm 11.25.x
- CPython 3.13.x and uv 0.7.x
- Docker-compatible local container runtime
- Supabase CLI
- Inngest CLI or approved local dev server
- Test-only AI provider credentials or deterministic fake adapters
- Test-only Google Drive OAuth application and dedicated fixture folder for Drive scenarios

Never use production credentials, personal documents, live job applications, or real private career data
in automated tests.

## Planned Workspace Commands

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
uv sync --project apps/worker --locked
supabase start
pnpm db:reset
pnpm seed:acceptance
```

Create local environment files from committed examples:

```bash
cp .env.example .env.local
cp apps/worker/.env.example apps/worker/.env
```

Populate only test values. Required classes of configuration:

- public Supabase URL and anonymous key;
- server-only database/service credentials;
- Inngest signing/event keys for the local environment;
- selected AI provider test credentials and approved model aliases;
- Google OAuth client for the test folder;
- object-storage buckets created by local seed/setup;
- OpenTelemetry endpoint and disabled/test Sentry/PostHog destinations.

The web client must never receive service-role, database, AI-provider, Google client-secret, workflow
signing, or observability-authentication credentials.

## Start the Local System

Use separate terminals:

```bash
pnpm dev:web
pnpm dev:workflows
uv run --project apps/worker career-worker serve
```

Expected local endpoints after implementation:

- public portfolio: `http://localhost:3000/`
- private dashboard: `http://localhost:3000/dashboard`
- local workflow console: address printed by `pnpm dev:workflows`
- worker health: private/local endpoint printed by the worker command

The seeded test owner signs in using the local authentication fixture documented by the implementation.

## Baseline Verification Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
uv run --project apps/worker pytest
pnpm test:db
pnpm test:contracts
pnpm test:integration
pnpm test:e2e
pnpm test:a11y
pnpm test:ai-evals
pnpm test:security
pnpm test:performance
```

Expected result: all commands exit successfully, no test connects to production, and generated reports
identify the application revision, schema version, prompt/retrieval versions, and fixture dataset hash.

## Scenario 1: Public Portfolio and Accessibility

**Requirements**: FR-028–FR-038, NFR-001–NFR-003, SC-001, SC-016, SC-017.

1. Seed an approved publication containing every required one-page section.
2. Open `/` at desktop and representative mobile viewports.
3. Use anchor navigation for About, Experience, Projects, Impact, Skills, Writing, Match, Ask, and
   Contact.
4. Navigate only by keyboard and repeat with a screen reader accessibility tree.
5. Enable reduced motion and scroll through the career journey.
6. Stop AI/workflow/worker processes and reload the portfolio.

Expected outcomes:

- The primary experience stays on one page; project/article details may open dedicated routes.
- The active desktop career stage corresponds to visible content; mobile/reduced-motion mode is a plain
  readable vertical timeline with native scrolling.
- Focus, landmarks, names, contrast, and controls meet WCAG AA checks.
- Approved content remains available when AI and private workers are unavailable.
- The performance report meets the 2.5-second usable-content target on the defined mobile profile.

## Scenario 2: Manual Career Fact, Evidence, and Publication

**Requirements**: FR-007–FR-027, FR-003, ST-001, PSR-001–PSR-002, SC-002, SC-006, SC-008.

1. Verify anonymous access to `/dashboard` is rejected, then sign in through the seeded callback and
   verify an invalid/expired callback fails safely.
2. Open `/dashboard`, verify its actionable summary links only to owner-authorized records, and create a
   private manual achievement with evidence and a metric.
3. Confirm it is owner-verified but absent from all anonymous portfolio/API responses.
4. Change visibility to public and add a Portfolio Projection rule.
5. Build a preview and inspect validation findings.
6. Confirm publication using the exact staged content hash.
7. Verify the item and safe citation appear publicly.
8. Sign out, confirm the session cannot be reused, then sign in and withdraw the publication or remove
   eligibility; verify cache/public reachability is removed.

Expected outcomes:

- Manual data has source, verification, version, visibility, and audit history.
- Public content changes only after explicit publish confirmation.
- No private description, raw evidence, object key, embedding, note, or confidence leaks.
- Old publication and fact versions remain privately traceable.

## Scenario 3: Drive Synchronization and Fact Review

**Requirements**: FR-010–FR-018, ST-002, NFR-005–NFR-009, SC-007–SC-008.

1. Connect the dedicated test Drive folder.
2. Add one PDF, one DOCX, one text/Markdown file, and one supported Google-native document.
3. Trigger synchronization and inspect run/step status through completion.
4. Review extracted facts with source locations, confidence, trust, and model/parser versions.
5. Approve one, edit-and-approve one, reject one, and defer one.
6. Run sync again unchanged; then modify one file and remove another.
7. Interrupt a parsing step and allow the workflow to retry.

Expected outcomes:

- Unchanged files create no new version, chunks, facts, or embeddings.
- Changed content creates one immutable version; removal creates a tombstone and revokes retrieval without
  silently deleting approved history.
- Retry resumes from durable steps and creates no duplicates.
- Extraction never approves or publishes facts automatically.

## Scenario 4: Malicious Document and Prompt Injection

**Requirements**: FR-125, AIR-003–AIR-007, PSR-004–PSR-007.

1. Upload fixtures with mismatched MIME/extension, archive expansion, oversized PDF content stream,
   hidden instructions, unsafe HTML, and text asking the model to reveal secrets or alter permissions.
2. Attempt arbitrary URL ingestion against loopback, private, link-local, metadata, IPv6 special ranges,
   and a redirect to a forbidden address.
3. Inspect quarantine, rejection, telemetry, and audit results.

Expected outcomes:

- Unsafe files fail closed in an isolated worker with bounded resources and sanitized errors.
- External text is stored as untrusted evidence and cannot change system/tool instructions.
- SSRF targets and unsafe redirects never receive a connection.
- No secret, signed URL, document text, or raw payload appears in logs/traces/errors.

## Scenario 5: Public AI Grounding and Privacy

**Requirements**: FR-039–FR-044, AIR-001–AIR-008, PSR-001, SC-003–SC-004.

1. Seed one public direct claim, one public transferable claim, one private direct claim, one conflicting
   claim pair, and one unsupported topic.
2. Ask questions for each category through public chat.
3. Attempt direct and indirect requests for private evidence, system prompts, internal IDs, and secrets.
4. Inspect the private retrieval/generation trace and public citations.

Expected outcomes:

- Public candidate queries never include private chunks; no response implies private evidence exists.
- Every material supported claim cites a handle supplied in its exact generation context.
- Unknown/model-invented citation handles fail deterministic validation.
- Unsupported and conflicting cases abstain or qualify explicitly.
- Telemetry contains versions, ranks, counts, latency, and policy results but no source/prompt/answer text by
  default.

## Scenario 6: Recruiter Job-Description Match

**Requirements**: FR-045–FR-050, SC-005, SC-011.

1. Submit a fixture JD containing required, preferred, optional, repeated, and ambiguous requirements.
2. Confirm normalized requirements against the labeled fixture.
3. Inspect the separate evidence retrieval for every meaningful requirement.
4. Recalculate the weighted score independently from returned values.
5. Repeat with no relevant evidence and with malicious instructions embedded in the JD.

Expected outcomes:

- Each meaningful requirement appears exactly once with priority, classification, evidence value, weight,
  citations, and explanation.
- The score equals the published deterministic formula and is unchanged by the explanation model.
- Malicious JD text is data; unsupported requirements are No Evidence rather than fabricated matches.

## Scenario 7: Job Discovery, Deduplication, and Failure Isolation

**Requirements**: FR-051–FR-068, ST-003, SC-009–SC-011.

1. Configure two test adapters and one search profile with schedule and scoring weights.
2. Make both adapters return the same job plus distinct jobs; make one adapter fail on its second page.
3. Run the search twice with the same logical date/idempotency key.
4. Add a matching manual pasted-description job.
5. Review career match vs opportunity score and transition one job through several states.

Expected outcomes:

- One canonical duplicate retains all source references; distinct jobs remain distinct.
- The second run creates no duplicate jobs or transitions.
- Successful-source results persist while the run is partial and the failure is visible.
- Manual and automated jobs share the same downstream analysis.
- Scores expose exact versioned factors and state history is append-only.

## Scenario 8: Application Package and Human Control

**Requirements**: FR-069–FR-092, ST-004, SC-012–SC-013.

1. Create an application for an interested job and paste representative form questions.
2. Upload one private application document, attach one lawful link, create a new version, then remove the
   workspace association and verify generated/final artifacts are unaffected.
3. Fill deterministic identity fields from the approved private profile.
4. Request an evidence-backed answer, CV, cover letter, and compensation research.
5. Attempt to generate a sensitive demographic answer without owner input.
6. Edit artifacts, mark exact versions final, assemble a package, and record a submitted snapshot.
7. Inspect every source-document provenance record, claim/evidence link, and exact PDF/DOCX version.

Expected outcomes:

- Career drafts use current JD context, length limits, evidence, and owner review.
- Sensitive demographic answers are not inferred.
- CV/letter content is separate from deterministic layout and exact binaries are versioned.
- Compensation includes dated sources, assumptions, confidence, and floor/target/stretch.
- No network call submits a form, application, salary expectation, or recruiter message.

## Scenario 9: Interview Preparation and Journal Integrity

**Requirements**: FR-093–FR-108, ST-005, SC-014–SC-015.

1. Create an interview process from a fixture with partial stage evidence.
2. Verify evidence-based stages and add/reorder a manual stage.
3. Generate a stage kit and predicted questions with probability bands.
4. Map questions to Career Brain evidence and STAR stories.
5. Complete a mock interview and add post-interview journal text.
6. Generate insights and compare the original text hash before/after.

Expected outcomes:

- Unknown stages are labeled unknown rather than invented.
- Questions are confidence-banded, not guaranteed, and stories are evidence-backed.
- Feedback is qualitative and does not claim scientific precision.
- Original journal content is unchanged; derived insights are separately stored/reviewable.
- No live meeting-join, transcription, or answer-assistance capability exists.

## Scenario 10: Blog, Analytics, and Career Gaps

**Requirements**: FR-109–FR-119, ST-006, SC-020–SC-022.

1. Draft a technical article with AI help and an approved career example.
2. Publish only after explicit approval; then archive it.
3. Generate allowlisted page/section engagement, project/article view, AI conversation, JD analysis,
   skill-query, project-interest, and private job/application/interview fixture events; attempt one event
   containing arbitrary private text.
4. Inspect filtered funnel and time metrics against source records.
5. Run gap analysis where a skill is possessed but not documented.

Expected outcomes:

- The article remains private before approval and published versions are immutable.
- Technical writing is indexed as technical knowledge, not independent career proof.
- Analytics accept only allowlisted privacy-conscious properties and remain private.
- Aggregates match lifecycle records within the SC-021 tolerance.
- The gap is “no evidence documented,” with separate document/demonstrate/write/learn actions.

## Scenario 11: Workflow Observability and Recovery

**Requirements**: FR-120–FR-126, ST-007, NFR-005–NFR-009, SC-018–SC-019.

1. Configure two AI task types with different provider/model/creativity/length/timeout/retry/fallback
   settings; verify an unavailable combination is rejected and no secret is returned.
2. Run one successful, one partial, one failed/retried, and one cancelled workflow.
3. Stop and restart the worker between durable steps.
4. Disable the AI provider and one job source while the public web app remains running.
5. Search run history by correlation and related record.
6. Request a portable export, inspect progress, download it after authorization, and verify an expired or
   cross-owner download is denied.

Expected outcomes:

- Every run and step exposes state, version, timestamps, attempts, references, and sanitized error.
- Restart resumes without duplicated external effects.
- Public portfolio and verified Career Brain remain available.
- No automation purpose can publish, submit, send, or change verified evidence.

## Release Gate

A release candidate is acceptable only when:

1. all baseline commands pass in CI and an isolated preview environment;
2. database/RLS tests include explicit anonymous, owner, cross-owner, worker, and service-role denial paths;
3. AI evaluation gates meet SC-003, SC-004, SC-005, SC-013, and adversarial privacy targets;
4. accessibility, MP-005 browser compatibility, MP-006 usability, MP-007 document-corpus, and
   MP-001–MP-004 performance reports meet NFR/SC thresholds;
5. migration forward-recovery and backup/restore are rehearsed;
6. OpenTelemetry export inspection finds no fixture secret or private content;
7. final artifacts link to specification requirements, contract versions, and test evidence;
8. portable export contents and authenticated status/download behavior satisfy NFR-012;
9. a human reviewer approves the specification/plan/tasks for implementation and separately approves
   production promotion—neither implementation authorization nor deployment is autonomous.
