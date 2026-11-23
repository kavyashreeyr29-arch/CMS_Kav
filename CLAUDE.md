# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Project

ElevatoHub — a role-aware ticketing/PM platform. Full spec lives in `docs/` (`prd.md`, `lld.md`,
`designsystem.md`) plus the original front-end-only mock at `docs/prototype/pulse-dashboard.jsx`.
Repo layout: `backend/` (NestJS + Prisma + PostgreSQL), `frontend/` (React + Vite), `e2e/`
(Playwright), orchestrated via the root `docker-compose.yml`.

## Mandatory workflow for any change

These two rules are non-negotiable — apply them to every change, not just large ones.

### 1. Test with Playwright before calling anything done

- The stack must be running (`docker compose up -d` from repo root) before running e2e tests.
- Run the suite from `e2e/`: `npx playwright test` (add `--headed` or `--ui` to watch it).
- **Any UI-visible change or new feature needs a Playwright test added or updated** in `e2e/tests/`
  covering the new behavior — not just a manual check. If a change only touches the backend with no
  frontend surface, hit the endpoint directly (`curl`/httpie) with a real auth token as a minimum bar;
  prefer extending the Playwright suite if there's any way to reach it through the UI.
- Never mark a task complete with failing or skipped tests. If a test fails, fix the root cause — don't
  loosen the assertion to make it pass unless the assertion itself was wrong (and say so).
- `npm install` + `npx playwright install chromium` only needs to happen once per machine; the browser
  binary is cached under `%LOCALAPPDATA%\ms-playwright`.

### 2. Document every change

- **New feature or non-trivial change → add an entry to `CHANGELOG.md`** (newest section on top, dated,
  under `### Added` / `### Changed` / `### Fixed` as appropriate). Follow the existing entries' level of
  detail: say what changed and why, not just what file moved.
- If the change alters how the project is set up, run, or tested, update `README.md` too.
- If the change reveals a new gotcha future-Claude should know about (like the ones below), add it to this
  file, not just the changelog — the changelog is a history; this file is the standing instructions.

## Known environment gotchas (don't rediscover these)

- **PowerShell tool sessions don't inherit PATH updates.** After installing something system-wide (Node,
  Docker, etc.), each new PowerShell tool call still starts from a stale cached PATH. Prefix commands with:
  ```powershell
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
  ```
  The Bash (Git Bash) tool has the same issue and generally can't see Node/Docker at all — use PowerShell
  for anything that needs them.
- **Prisma on `node:20-alpine` needs OpenSSL installed explicitly** (`apk add --no-cache openssl` in the
  Dockerfile) or its engine binary fails with a confusing "could not parse schema engine response" error
  instead of a clear linker error.
- **`nest start --watch` doesn't detect file changes on a Windows bind mount by default.** Docker Desktop's
  bind mounts don't reliably emit native fs events there. `backend/tsconfig.json` sets `watchOptions` to
  `fixedPollingInterval` to work around it; the frontend's `vite.config.ts` has the equivalent
  `server.watch.usePolling`. If you add another watch-mode process, it'll need the same treatment.
- **Never `include: { someRelation: true }` on a `User` relation.** That returns every column, including
  `passwordHash`. Always use `{ select: SAFE_USER_SELECT }` from
  `backend/src/common/prisma/safe-user-select.ts` (or a purpose-built `select` for admin-only views like
  `users.service.ts`'s `USER_SELECT`). This was a real bug shipped in the initial scaffold — verify with a
  live request (`curl .../tickets | grep passwordHash`) after touching any endpoint that nests a user,
  don't just trust that Prisma "wouldn't do that."
- No Node.js is required to just *run* the stack via Docker — the containers install their own
  dependencies. Node is only needed on the host for the `e2e/` Playwright suite (and for anything you want
  to run outside Docker).

## Permission model — the thing to protect

Every ticket read path must go through `ticketVisibilityWhere()` (`backend/src/common/permissions/
ticket-scope.ts`) at the query level — never filter client-side or bolt on a check after the fact. If you
add a new ticket-reading endpoint, this is the first thing to wire up, and the first thing to check in
review.
