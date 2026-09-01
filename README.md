# AI Career OS

AI Career OS is a Next.js portfolio and private career workspace backed by Supabase, Inngest, and an
isolated Python worker. The public portfolio only reads the active, approved publication; career data,
documents, applications, and workflow state remain owner-scoped.

## Prerequisites

- Node.js 24.x and pnpm 11.25.x
- Python 3.13.x and uv 0.7.x
- Supabase CLI
- Docker-compatible runtime for local Supabase (optional when using Supabase Cloud)
- k6 for the performance command

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
supabase test db --linked
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

Use separate terminals from the repository root:

```bash
pnpm dev:web
pnpm dev:workflows
uv run --project apps/worker career-worker serve
```

- Web app: <http://localhost:3000>
- Inngest development UI: the URL printed by `pnpm dev:workflows`
- Worker health/workflow server: <http://127.0.0.1:8080>

Supabase Cloud is the database, authentication, and API layer; it does not host the Next.js user
interface. Open the Web app URL above (or deploy `apps/web` to a Next.js host and set
`NEXT_PUBLIC_APP_URL` to that deployed URL).

The public page is `/`. Private workspaces include `/dashboard`, `/career-brain`, `/documents`,
`/jobs`, `/applications/<id>`, and `/interviews/<id>`. Sign-in uses the Supabase Auth callback at
`/auth/callback`.

To add Basil's hero portrait, place the image in `apps/web/public/images/` and set, for example,
`NEXT_PUBLIC_PROFILE_IMAGE_URL=/images/basil-ogbonna.jpg` in `.env.local`. The hero displays a styled
monogram placeholder until that value is configured.

The profile stickers immediately below the portrait read approved profile fields first and then the
`NEXT_PUBLIC_LINKEDIN_URL`, `NEXT_PUBLIC_GITHUB_URL`, and `NEXT_PUBLIC_CONTACT_EMAIL` environment
values. Unconfigured stickers remain visible as placeholders instead of inventing destinations.
The public navigation includes an **Owner login** link to `/sign-in` for the private workspace.

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

Keep release evidence in `docs/validation/release-evidence.md`. Hosted migration, backup/restore, and
production promotion checks require a dedicated staging project and human approval; never use personal
or production data in fixtures.
