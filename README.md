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
a private binary; keep both the Inngest development server and parser/indexer above running, then use
**Index knowledge** on `/documents`. The status changes to `indexed` only after a durable ingestion
run creates the evidence version, chunks, and embeddings.

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
   select **Index knowledge** for any item waiting on parsing or embeddings.

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
