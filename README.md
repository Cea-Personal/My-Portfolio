# Basil Ogbonna · Portfolio and Career Workspace

This is Basil Ogbonna's Next.js portfolio and private career workspace backed by Supabase, Inngest,
and an isolated Python worker. The public portfolio only reads the active, approved publication;
career data, documents, applications, and workflow state remain owner-scoped.

## Prerequisites

- Node.js 24.x and pnpm 11.25.x
- Python 3.13.x and uv 0.7.x
- Supabase CLI
- Docker-compatible runtime for local Supabase (optional when using Supabase Cloud)
- k6 for the performance command
- PostgreSQL client (`psql`) for the hosted pgTAP command

## Install and configure

```bash
pnpm install --frozen-lockfile
uv sync --project apps/worker --locked
cp .env.example .env.local
cp apps/worker/.env.example apps/worker/.env
```

Fill in test or development values only. `SUPABASE_SERVICE_ROLE_KEY`, provider references, workflow
signing keys, and observability credentials are server/worker-only and must never be exposed to the
browser or committed.

## Supabase Cloud (recommended)

Create a free project at [Supabase](https://supabase.com/), then authenticate and link the repository:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
SUPABASE_DB_URL='postgresql://...?...sslmode=require' pnpm test:db:hosted
```

Set the linked project's URL and anonymous key in `.env.local`, and its service-role key only in the
server deployment environment. In the Supabase API settings, expose the `app`, `api`, and `published`
schemas. The `app` schema is still protected by authenticated grants and RLS; anonymous users can only
read active publication views. See [infra/environments/supabase.md](infra/environments/supabase.md) for
the staging and backup checklist.

### Finding the hosted tables

The application tables are not in the default `public` schema. In Supabase Studio, open **Table
Editor** and change the schema selector to `app` or `published`. The `public` schema can therefore
appear empty even when migrations are applied. Confirm the inventory in **SQL Editor** with:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('app', 'published', 'api')
order by table_schema, table_name;
```

## Local Supabase

With Docker running:

```bash
supabase start
pnpm db:reset
```

The local project uses the values printed by `supabase status`. Update `.env.local` if the anon or
service-role keys differ from `.env.example`.

## Run the application

Start the web app, Inngest development workflow runner, and document parser/indexer together from
the repository root:

```bash
pnpm dev
```

For troubleshooting, the web app and workflow runner can still be started separately with
`pnpm dev:web` and `pnpm dev:workflows`. The worker can be started separately with
`uv run --project apps/worker career-worker inngest`.

- Web app: <http://localhost:3000>
- Inngest development UI: the URL printed by `pnpm dev` (or `pnpm dev:workflows`)
- Inngest development server/UI: <http://127.0.0.1:8288>
- Document parser/indexer: <http://127.0.0.1:8081>

Document vectors are stored in the `app.chunk_embeddings.embedding` column, not in the `public`
schema. In Supabase Studio, select the `app` schema and open `chunk_embeddings`; source text chunks
are in `app.evidence_chunks`. The `vector` extension may appear under `public` in Studio—this is the
type provider and does not require vector-bearing tables to live in `public`. Uploading alone creates
a private binary; keep both the Inngest development server and parser/indexer above running. New and
changed documents are indexed automatically. The status changes to `indexed` only after a durable
ingestion run creates the evidence version, chunks, and production model embeddings.

Before indexing, open **Settings → AI providers** and register an embedding model (for example,
provider `openai`, model `text-embedding-3-small`, capability `embeddings`, and secret reference
`OPENAI_API_KEY`). Put that named secret in `apps/web/.env.local`, restart `pnpm dev`, then open
**Settings → Agents** and enable the `embedding` task with that provider. Ingestion fails closed if
no enabled embedding capability or server-side credential is available; deterministic hash vectors
are not generated. Existing legacy vectors are ignored because retrieval filters by the selected
provider, model, and model version. Reprocess an existing document to create production embeddings.

All reasoning agents run as subagents under one owner-configured orchestrator model. In **Settings →
AI providers**, register the chat/generation model with a reasoning capability (or `*`), then in
**Settings → Agents** select it once and enable **Save orchestrator**. Portfolio Q&A, role fit,
career synthesis, job matching, document composition, compensation, interview preparation, and
writing use that same model; each role keeps its own prompt, tools, permissions, and output schema.
Embeddings are intentionally separate because they are a retrieval model, not an agent. Creating an
interview process automatically asks the interview subagent to prepare stage-specific likely
questions, CV alignment, evidence-grounded answer stories, revision areas, and questions to ask the
interviewer. There is no manual STAR-story form in the normal workflow.

The web application exposes this orchestration boundary in `/api/v1/orchestrator/tasks`. Native Codex
custom agents live in `.codex/agents/*.toml`, with shared native settings in `.codex/config.toml`.
When the registered provider is `codex_app_server`, the Next.js server starts one ephemeral
`codex app-server --stdio` orchestrator thread for each bounded reasoning turn. The parent explicitly
delegates exactly one request through native `spawn_agent`; the web adapter requires a child-agent
event before accepting the result. This uses the local Codex login; it does not reuse the browser's
Supabase session as a Codex credential. Configure `CODEX_APP_SERVER_COMMAND`,
`CODEX_APP_SERVER_ARGS`, or (when launched outside the repository) `CODEX_PROJECT_ROOT` only when
the defaults need to change. Embeddings remain a separate provider, and the existing OpenAI/provider
path remains the fallback when the Codex runtime is unavailable.

The orchestrator defaults to `gpt-5.6-sol` with high reasoning. Career synthesis, interview coaching,
and application writing explicitly use `gpt-5.6-terra` with high reasoning. Job matching and career-gap
analysis use `gpt-5.6-terra` with medium reasoning, while writing and portfolio assistance use
`gpt-5.6-luna` with low reasoning. Other native agents inherit the orchestrator/default model unless
their agent file overrides it.

Local development uses a parser-only default secret when none is configured. Deployed environments
must set the same strong `CAREER_WORKER_SHARED_SECRET` on the Web/Inngest runtime and worker runtime;
production has no default and fails closed when either the worker URL or secret is absent.

Supabase Cloud is the database, authentication, and API layer; it does not host the Next.js user
interface. Open the Web app URL above (or deploy `apps/web` to a Next.js host and set
`NEXT_PUBLIC_APP_URL` to that deployed URL).

The public page is `/`. Private tabs are Career Brain, Jobs, Application Kit, Interview Kit, Journals,
Blog, Settings, and Portfolio. Settings contains documents, analytics, agents, automations, search
profiles, job sources, providers, and exports. Sign-in uses the Supabase Auth callback at
`/auth/callback`.

Application Kit keeps CVs and cover letters attached to the job application that produced them. Use
the material composer in an application to create versioned drafts, then review or download them
from Application Kit (or the CV/Cover Letters history pages). Application profiles can be edited in
place; deleting one archives it, clears any application selections, and removes it from future
dropdowns without destroying the audit history. Search profiles support the same edit/archive flow
under **Settings → Search profiles**.

### LinkedIn job intake and interview packages

In **Jobs**, paste a LinkedIn listing URL while entering its title, company, and description. The
owner-supplied URL is retained as a reference; the app does not scrape LinkedIn. For automated
discovery, configure **LinkedIn (authorized feed)** under **Settings → Job sources** with an
authorized or licensed provider endpoint and a terms/access note.

For no-key remote-job discovery, configure these presets under **Settings → Job sources**:

- **Jobgether (public API)** — \`https://jobgether.com/api/v1/jobs\`
- **Remote OK (public JSON feed)** — \`https://remoteok.com/api\`
- **Arbeitnow (public API)** — \`https://www.arbeitnow.com/api/job-board-api\`
- **Adzuna** — \`https://api.adzuna.com/v1/api/jobs/gb/search/1\` (set \`ADZUNA_APP_ID\` and \`ADZUNA_APP_KEY\`)
- **JSearch** — RapidAPI (set \`JSEARCH_RAPIDAPI_KEY\`)
- **FlyByAPIs Jobs Search** — RapidAPI (set \`FLYBYAPIS_RAPIDAPI_KEY\`)
- **SerpApi Google Jobs** — \`https://serpapi.com/search.json\` (set \`SERPAPI_API_KEY\`)
- **TheirStack** — \`https://api.theirstack.com/v1/jobs/search\` (set \`THEIRSTACK_API_KEY\`)
- **JobsPipe** — \`https://api.jobspipe.dev/v1/jobs/search\` (set \`JOBSPIPE_API_KEY\`)

The adapters translate the active search profile into each provider's query shape, discard malformed
metadata records, preserve the provider listing URL, and feed the normal raw-job, eligibility,
deduplication, and matching pipeline. Title/location mismatches and explicit exclusions are filtered
before canonical jobs are created; required technologies are rejected when the listing contains
searchable description text, while description-less listings remain reviewable. These feeds do not
require a paid API key, but they do require
reasonable request volume and source attribution. Jobgether's returned URL is its listing page, not
necessarily the employer's application URL. Jobgether's list response does not include a full job
description; when it supplies an optional description-like field the adapter preserves it, otherwise
the listing URL remains the source of the full description.

RapidAPI providers use the server-side secret reference configured for the source. The application
never stores provider keys in Supabase. Scheduled job-search automations run on weekdays and cap
new canonical jobs at ten per owner/day; existing fingerprints are updated rather than duplicated.

For Jobgether, the adapter maps target and preferred titles to slugified `jobReferences` (for example,
`frontend developer` becomes `frontend-developer`), locations/regions to comma-separated `locations`,
industries to `industries`, seniority to `experience`, employment type to `contractType`, work
arrangements to `remoteType`/`includeHybrid`, and salary bounds to `salaryMin`/`salaryMax` with
`currency`. Requests use `sort=relevance`, `limit=25`, and iterate pages 1–10. Results older than the
profile's `maxJobAgeDays` cutoff are discarded locally because the provider does not expose a posted-date
filter. Unsupported or unknown provider values are retried without the structured filter and remain
subject to local profile eligibility.

The Jobs workspace also has an opt-in **Live web discovery** action. It uses the configured OpenAI
orchestrator with the Responses API web-search tool, restricts retrieval to the domains entered in the
form, optionally grounds the query with indexed private Career Brain evidence, and validates every
returned HTTPS listing URL. Profile-eligible (PASS) listings are attached to the private opportunity
pipeline automatically with their search profile, run, source, discovery time, and match reasons.
Existing opportunities are deduplicated by canonical URL/fingerprint. Listings whose requirements
cannot be proven from the result are persisted as REVIEW events and shown in the review queue; FAIL
listings are retained only as rejected discovery events. Configure and enable the orchestrator in
**Settings → AI providers / Agents** first; no separate search key is required. Set
`OPENAI_RESPONSES_URL` only when using an OpenAI-compatible proxy. Live discovery never logs in to or
scrapes LinkedIn, never publishes results, and never submits an application.

When an application form or employer question is captured, the Application Kit automatically asks the
configured orchestrator to answer those exact fields. It receives the selected job description and
company, selected application profile, attached/generated CV and cover-letter materials, Career Brain
facts, and retrieved private evidence. Motivation and experience answers are tailored to the role;
salary answers use configured search-profile/job salary data when available. Authorization,
sponsorship, availability, and demographic fields are never guessed and remain marked for explicit
owner input when the profile does not supply a value. Each generated answer stores its evidence IDs,
generation context, model version, and a new version number. Answers are editable and can be
regenerated after new evidence is indexed; final approval remains an owner decision.

The ATS adapters have different credential rules. Greenhouse public job-board endpoints, Lever's
public postings feed, and Ashby's public job-posting API generally need no key when you are reading
published postings. SmartRecruiters, Workable, Teamtailor, Personio, Recruitee, and private/company
endpoints may require an employer-issued API token or account. Obtain those credentials from the
provider's developer/integrations area or from the employer who owns the board, then store only the
environment-variable name in Job Sources (never the token itself). LinkedIn requires an
authorized/licensed provider feed; a normal LinkedIn login is not an API key.

In **Interview Kit**, create a process from an application and choose **Generate / refresh interview
package**. The planner reads the selected job description, infers stages when evidence is present (or
labels the process unknown), compares indexed private CV excerpts, and maps only approved Career Brain
evidence to confidence-labelled questions, preparation guidance, and evidence gaps. No live interview
joining, transcription, or hidden assistance is provided.

To add Basil's hero portrait, place the image in `apps/web/public/images/` and set, for example,
`NEXT_PUBLIC_PROFILE_IMAGE_URL=/images/basil-ogbonna.jpg` in `.env.local`. The hero displays a styled
monogram placeholder until that value is configured.

The profile stickers immediately below the portrait read approved profile fields first and then the
`NEXT_PUBLIC_LINKEDIN_URL`, `NEXT_PUBLIC_GITHUB_URL`, and `NEXT_PUBLIC_CONTACT_EMAIL` environment
values. Unconfigured stickers remain visible as placeholders instead of inventing destinations.
The public navigation includes an **Owner login** link to `/sign-in` for the private workspace.

### Connect a Google Drive career folder

1. In Google Cloud, enable the Drive API and create a service account with a JSON key. It does not
   need a Google Workspace role or domain-wide delegation.
2. Create a dedicated `Resumes` folder under **My Drive**. Share only that folder with the service
   account's `client_email` as **Viewer**. Do not share the Drive root.
3. Copy the folder ID from its Drive URL and configure the server values below.
4. Sign in at `/sign-in`, open **Settings → Documents**, and select **Verify and activate shared
   folder**, followed by **Sync selected folder**.
5. Keep the Inngest workflow process and career worker running. Imported files appear in Documents;
   newly imported or changed files are queued for indexing automatically. Use **Reprocess** only to
   retry a failed item or regenerate it with a newly selected embedding model.

The active Drive integration does not use user OAuth and never requests access to your personal
Drive. Its `drive.readonly` token belongs to the isolated service account, which can see only items
shared with that account. The worker additionally lists files exclusively by the configured parent
folder ID. Configure:

```bash
# macOS/Linux: encode the downloaded JSON without line wrapping
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64="$(base64 < service-account.json | tr -d '\n')"
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_FOLDER_NAME=Resumes
```

Keep these values server-only. Never prefix them with `NEXT_PUBLIC_` and never commit the JSON key.
Apply the Drive migrations before activating the folder:

```bash
supabase db push
```

### Project enquiry form

The portfolio contact form sends enquiries through Resend when these server-only values are set in
the deployment environment (and optionally in `.env.local` for development):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Basil Ogbonna <portfolio@your-verified-domain.com>"
CONTACT_EMAIL=you@example.com
```

`RESEND_FROM_EMAIL` must use a domain verified in Resend. The form includes basic input validation,
a hidden spam trap, and per-IP rate limiting; it will show a safe error while delivery is not
configured. Resend's send-email API accepts a sender, recipient, reply-to address, subject, and HTML
body. [Resend API reference](https://resend.com/docs/api-reference/emails/send-email)

If port 3000 is occupied, run browser checks on another port:

```bash
PLAYWRIGHT_PORT=3100 pnpm test:e2e -- --project=chromium
PLAYWRIGHT_PORT=3100 pnpm test:a11y -- --project=chromium
```

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:contracts
pnpm test:integration
pnpm test:security
pnpm test:ai-evals
pnpm lint:worker
pnpm test:worker
pnpm build
```

Database/pgTAP, browser, accessibility, and performance checks require their respective local or hosted
services:

```bash
pnpm test:db
pnpm test:e2e
pnpm test:a11y
pnpm test:performance
```

For the release gate, provide an isolated Cloud database connection URL (never a production URL) and run
the hosted SQL suite directly with `psql`:

```bash
SUPABASE_DB_URL='postgresql://...?...sslmode=require' pnpm test:db:hosted
```

The release workflow requires this value as the `SUPABASE_DB_URL` secret, installs the PostgreSQL client,
and fails closed if the URL or any other hosted fixture credential is missing.

Keep release evidence in `docs/validation/release-evidence.md`. Hosted migration, backup/restore, and
production promotion checks require a dedicated staging project and human approval; never use personal
or production data in fixtures.
