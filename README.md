# ElevatoHub

Unified project, ticket, and team intelligence platform. See `docs/prd.md`, `docs/lld.md`, and
`docs/designsystem.md` for the full spec this implementation follows, and `docs/prototype/pulse-dashboard.jsx`
for the original front-end-only reference mock.

## Repo structure

```
elevatozhub/
├── backend/          NestJS + Prisma + PostgreSQL API (docs/lld.md §1-§9)
├── frontend/         React + Vite client (docs/designsystem.md, ported from the prototype)
├── docs/             PRD, LLD, design system, and the reference prototype
├── e2e/              Playwright end-to-end tests, run against the live Docker Compose stack
├── docker-compose.yml   Postgres, Redis, Adminer, backend, frontend — one command to run everything
└── .env.example      Root compose overrides (copy to .env)
```

## Prerequisites

- **Docker Desktop**, with its CLI on PATH (`docker --version` and `docker compose version` should both work).
- No local Node.js install needed if you're running via Docker — the containers install their own dependencies.
- For running the backend/frontend **without** Docker, you'll need Node.js 20+ and a local PostgreSQL 16 instance.

## Quick start (Docker)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up --build
```

This starts:
- `postgres` on `localhost:5432`
- `redis` on `localhost:6379`
- `adminer` (DB browser UI) on `localhost:8080`
- `minio` (S3-compatible object storage for attachments/documents) on `localhost:9000`, console on
  `localhost:9001` (login with `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` from `.env`); `minio-init` runs once
  to create the bucket and exits — that's expected, not a failure
- `backend` (NestJS API) on `localhost:3000`, auto-running `prisma db push` on startup
- `frontend` (Vite dev server) on `localhost:5173`

**First run only** — seed demo data (projects, users, tickets matching the prototype):

```bash
docker compose exec backend npm run seed
```

Then open `http://localhost:5173` and sign in with any seeded email (see `backend/prisma/seed.ts`) and
password `password123`.

## Quick start (without Docker)

1. Install PostgreSQL 16 locally and create a database (`createdb elevatohub`, or via your OS's tooling).
   Also run a local MinIO (or point at real S3) — see `backend/.env.example` for the `S3_*` variables;
   `S3_ENDPOINT` must be an address your *browser* can reach, since the backend only signs URLs and the
   browser uploads/downloads directly against the object store.
2. Backend:
   ```bash
   cd backend
   cp .env.example .env   # edit DATABASE_URL to point at your local Postgres
   npm install
   npm run prisma:push
   npm run prisma:apply-constraints
   npm run seed
   npm run start:dev
   ```
3. Frontend (separate terminal):
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

## End-to-end tests

The Playwright suite in `e2e/` runs against the actual Docker Compose stack (not a mocked environment),
so start the stack and seed it first:

```bash
docker compose up -d
docker compose exec backend npm run seed   # skip if already seeded

cd e2e
npm install
npx playwright install chromium   # first time only, downloads the browser binary
npx playwright test               # add --headed or --ui to watch it run
```

See `CLAUDE.md` for the standing rule: any UI-visible change or new feature should come with an added or
updated test here, not just a manual check.

## Email-to-ticket

`POST /email-intake/inbound` turns an inbound email into a ticket automatically — the reporter is
matched (or auto-provisioned as a Client-role user) by the sender's email address, and the ticket is
filed under `EMAIL_INTAKE_DEFAULT_PROJECT_CODE` (or a `projectCode` in the payload, if the caller knows
one). See `backend/src/email-intake/`.

**This app only exposes the webhook — it does not receive real email itself.** Routing an actual mailbox
(e.g. `support.elevatoz@loyalty.com`) to this endpoint needs provider-side configuration outside this
repo, one of:
- **AWS SES**: create a receipt rule on the domain that publishes to an SNS topic, and have a small Lambda
  (or any subscriber) map the SES/SNS payload to `{ from, subject, body }` and `POST` it here.
- **SendGrid Inbound Parse**: point the MX record at SendGrid, configure Inbound Parse to POST to a URL —
  either point it directly at this endpoint (after adapting SendGrid's multipart payload shape) or put a
  thin adapter in front of it.
- **Mailgun Routes**: similar — a Route with a "forward" action to a URL, same adapter need.

Whichever provider, set these two env vars (`backend/.env`, see `.env.example`):
```
EMAIL_INTAKE_SECRET=<a real random secret>
EMAIL_INTAKE_DEFAULT_PROJECT_CODE=<project code inbound emails should land in>
```
The provider (or its adapter) must send `Authorization: Bearer <EMAIL_INTAKE_SECRET>` on every call —
without a configured secret, the endpoint refuses all requests rather than accepting unauthenticated
ticket creation.

Manual test without a real provider:
```bash
curl -X POST http://localhost:3000/api/v1/email-intake/inbound \
  -H "Authorization: Bearer <EMAIL_INTAKE_SECRET>" -H "Content-Type: application/json" \
  -d '{"from":"someone@example.com","subject":"Login broken","body":"Details here."}'
```

## What's implemented vs. scaffolded

Fully implemented, matching `docs/lld.md`:
- Server-side permission scoping (`all` / `team` / `source` / `reporter`) applied at the query layer for every
  ticket read path — see `backend/src/common/permissions/`.
- Assignee redaction for Client-scoped viewers (department name, never the real identity).
- Full ticket lifecycle: create, status transitions with restricted-status enforcement, reopen, comments
  with @mention notifications, watchers, real file attachments (MinIO/S3-backed — see below), start/stop
  timers with a DB-level one-active-timer-per-person-per-ticket constraint, and a websocket channel
  broadcasting live timer state.
- Real object storage — MinIO in Docker Compose (swap for real S3/R2 credentials in production, same
  code path). The backend only signs URLs; the browser uploads/downloads directly against the store.
- SLA policy CRUD + resolution order + a scheduled breach-sweep cron job, surfaced in the UI as a badge on
  the ticket list and ticket detail (breached, or at-risk by `slaBreachRisk`).
- Ticket activity/history timeline (created, status changes, reopens, attachments, comments, merged
  chronologically) on the ticket detail page.
- Projects: full CRUD including a create modal, plus a document folder with the same real upload/download.
- Work-hours rollup with role-scoped visibility.
- The BYO-AI adapter layer (OpenAI/Anthropic/custom adapters behind one interface, encrypted API keys,
  usage logging, "AI-assisted" activity tagging).
- Backlog view (Story/Epic tickets, drag-to-reorder `backlogRank`).

Deliberately left as extension points (each is called out with a comment at its point in the code):
- Real email/Teams delivery — `NotificationsService.deliver()` is a no-op past the DB write; wire it to a
  queue (SQS/RabbitMQ/Redis Streams) once Phase 5 lands (`docs/lld.md` §6.1, §10).
- Duplicate/similar-ticket detection (`AIAdapter.findSimilar`) needs an embeddings store (pgvector or a
  hosted vector DB) — currently returns no matches.
- SLA bulk CSV/XLSX upload has a working backend endpoint (`POST /sla-policies/bulk-upload` with a
  `commit: false` preview mode) but no file-upload UI yet.
- Form `<label>`/`<input>` association is only fixed on the Login page; other forms (Create ticket, Add
  user, etc.) still lack `htmlFor`/`id` pairs (accessibility + testability gap).

## Why Docker Desktop was flagged during setup

At scaffold time, Docker Desktop was running as a process but its CLI wasn't resolving on PATH, and Node.js
wasn't installed at all — so nothing here has been run yet. Once `docker compose up --build` succeeds, treat
that as the first real verification pass; expect to fix minor issues (dependency version drift, etc.) on that
first run.

## Production deployment

- **Frontend (Vercel):** deploy `frontend/` and set `VITE_API_BASE_URL` to `https://elevatohub-api.onrender.com/api/v1`.
- **Backend (Render):** use the root `render.yaml` Blueprint with the `Free` web-service plan. Set `DATABASE_URL` to the Neon production pooled connection string and `FRONTEND_URL` to the Vercel origin.
- **Database (Neon):** use the `production` branch in the existing project. Render runs `prisma db push` during the build.
- **Storage:** configure Neon/R2-compatible AWS variables or the existing S3 variables. The browser needs a public browser-reachable signed endpoint; the backend only creates signed URLs.

Free Render services sleep after inactivity and can take 30–60 seconds to wake up.
