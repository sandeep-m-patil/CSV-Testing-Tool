# Autotest SaaS — Autonomous Web Application Testing Platform

Point it at a web app. It drives a real Chromium browser, discovers the app's
pages, forms and actions on its own, generates a full manual-style test matrix
from what it finds, then **executes** that matrix and reports pass/fail counts
with a screenshot for every case.

Postgres runs on **Neon**, Redis in **Docker**, everything else is
pnpm-workspace TypeScript. See [tech-stack](docs/tech-stack.md) for the stack,
architecture diagram and end-to-end workflows, and
[architecture](docs/architecture.md) for the deeper breakdown.

---

## Table of contents

- [What it does](#what-it-does)
- [Features](#features)
- [Pages](#pages)
- [Quickstart](#quickstart)
- [Commands](#commands)
- [Data model](#data-model)
- [REST API](#rest-api)
- [Repository layout](#repository-layout)
- [Security model](#security-model)
- [Status](#status)

---

## What it does

The pipeline, end to end:

1. **Create a project** — give it a `baseUrl` and an environment. A module named
   **"Whole site"** is created automatically and discovery is queued for it.
2. **Discover** — a worker logs in (if the module has credentials), walks the app
   inside a hard scope, and records every page, element, action, transition and
   masked screenshot as it goes.
3. **Generate** — discovered forms are classified (`email` + `password` → auth
   form, otherwise a generic form) and expanded into a **23-case login matrix**
   covering happy path, negative, validation, boundary, security and UI checks.
4. **Review** — browse the generated cases as a CSV-style grid: TC ID, test case,
   test data, expected result.
5. **Execute** — Playwright runs each case in its own isolated browser context,
   evaluates a machine-checkable expectation, and records `PASS` / `FAIL` / `SKIP`
   plus a screenshot per case.
6. **Report** — totals, pass rate and per-case screenshot evidence.

---

## Features

### 1. Authentication & sessions
- Sign up / sign in / sign out with cookie-based sessions signed by `AUTH_SECRET`.
- `requireSession()` guards every protected route; `requireModuleAccess()` scopes
  modules to their owning project.
- Same-origin CSRF check on all mutations.

### 2. Project → Module hierarchy
- **Project** — one web application. Owns `baseUrl`, `environment`
  (`development | qa | staging | production | custom`) and a `productionConfirmed`
  flag. **Production projects are hard-blocked from discovery and test runs.**
- **Module** — a browsable area of the project (e.g. *Materials*, *Lab Books*),
  with a `startPath` and `includePaths` that define a **hard crawl scope**.

**Automatic provisioning.** Creating a non-production project immediately creates
a **"Whole site"** module (no start path, so scope covers the entire base URL) and
queues discovery. Production projects are skipped. Existing projects get the same
via the **"Discover whole site"** button or `POST /api/projects/[projectId]/discover`.
Both are idempotent per project — they reuse an existing "Whole site" module
rather than stacking duplicates.

> A session stays `QUEUED` until the **worker is running**. If the UI shows
> "Waiting for logs…" with no evidence, start the worker (`pnpm dev` starts it for
> you).

### 3. Module configuration
- **Credentials** — username/password per role. Secrets are **AES-256-GCM
  encrypted** at rest; the UI only ever receives a `hasSecret` flag.
- **Test data** — key/value constants and CSV templates scoped to the module,
  used to fill discovery forms and seed generated cases.

### 4. Autonomous discovery control room
- `POST /api/modules/[moduleId]/discover` (optionally pick a login role) inserts a
  `QUEUED` session and enqueues a BullMQ job.
- Guards: same-origin CSRF, module access, production block, Redis availability.
- `/modules/[moduleId]/discovery` streams status, current URL, page/action/workflow
  counters, structured logs and evidence.

Per session the worker (Playwright + Chromium):
- launches an isolated, secret-safe context and logs in with the chosen role;
- walks the app within a configurable budget (pages, steps, actions/page, nav
  depth, timeouts);
- per page: collects elements → classifies the page → builds an indexed, deduped
  **action space** → picks the next *safe* action (destructive, logout and
  otherwise blocked actions are never executed) → runs it → records the transition;
- fills forms from module test data and submits;
- persists every page/action/log **immediately** so the UI streams in real time;
- captures a **secrets-masked screenshot** per executed action.

### 5. Workflow generation
From the executed action trace:
- a **form workflow** per page where something was filled and submitted
  (`GOTO → FILL* → SUBMIT → VERIFY`, values resolved from test data);
- a **navigation workflow** per other reachable page (`GOTO` + verify heading).
- Persisted as `source: discovered`, `status: DRAFT`, with a confidence score.

### 6. Test case generation
`apps/worker/src/test-generation/` expands discovered forms into step-by-step test
cases carrying `testData` and `expectedResult`.

A page whose controls classify as an **auth form** (an identifier field paired
with a password field) gets the full 23-case matrix:

| Category | Cases |
| --- | --- |
| Happy path | valid credentials · password masking · press-Enter submit |
| Negative | invalid email · invalid password · both invalid · unregistered email · email case sensitivity |
| Validation | email empty · password empty · both empty · malformed email · no username · no domain · password below minimum length |
| Boundary | leading/trailing spaces (email) · spaces in password · minimum-length password · 500-character input |
| Security | SQL injection (email) · SQL injection (password) · script injection |

Any other form gets a 5-case baseline: valid submit, empty required fields,
over-long input, SQL injection, script injection.

Three login cases (whitespace handling, show/hide password toggle) depend on a
product decision or human eyes, so they are generated **without** a
machine-checkable expectation and report as `SKIP` rather than inflating the
pass rate.

### 7. Test execution
- `POST /api/modules/[moduleId]/test-runs` queues a run over every case in the
  module; the worker executes them on a separate BullMQ queue.
- Each case runs in a **fresh browser context** so state cannot leak between
  cases.
- Steps carry a **portable locator hint** (`role:email`, `role:password`,
  `role:submit`, `role:text:1`, `selector:…`) resolved at run time, so cases
  survive restyling and can be re-run in another environment.
- Expectations are machine-checkable: `navigated_away`, `stayed_on_page`,
  `error_message_present`, `input_attribute`, `app_responsive`, and `any_of`
  for outcomes that are legitimately either.
- A screenshot is captured per case with sensitive inputs masked, stored under
  `modules/{moduleId}/runs/{runId}/`.
- `GET /api/test-runs/[testRunId]` returns the run, its totals and every result
  with a resolved screenshot URL.

### 8. Review & reporting
- `/modules/[moduleId]/review` — browse discovered workflows and generated test
  cases; approve/edit via the `workflows/*` and `test-cases/*` APIs.
- `GET /api/modules/[moduleId]/report` — per-module discovery summary.
- `/modules/[moduleId]/report` — printable report styling.

### 9. CSV interop
`apps/web/lib/test-cases/csv.ts` provides RFC 4180 serialisation and parsing, so
the grid round-trips through Excel. Steps use a compact DSL that is writable by
hand in a spreadsheet:

```
GOTO http://localhost:4000/login | FILL role:email a@b.c | SUBMIT role:submit | VERIFY stayed_on_page
```

`VERIFY` accepts `navigated_away`, `stayed_on_page`, `error_message`,
`app_responsive`, `attr:<target>:<attribute>=<value>`, and
`any_of:<expectation>,<expectation>`.

### 10. Health & evidence storage
- `GET /api/health` — Neon query latency + Redis ping → `ok` / `degraded`.
- **Local** driver (default) shares `../data/storage` between web and worker;
  evidence is served via `/storage/[...key]`.
- **S3** driver (aws-sdk v3, custom endpoint + `forcePathStyle` for Neon S3).

### 11. Optional AI augmentation
Adapter pattern (`mock` | `openai` | `local`) for submit detection and page
analysis. Everything is **deterministic and fully functional with
`AI_PROVIDER=mock`** — AI only upgrades heuristics, it is never required.

---

## Pages

| Route | Purpose |
| --- | --- |
| `/login`, `/signup` | Authentication (unauthenticated shell) |
| `/` | Landing / redirect |
| `/projects` | Project list, create project (base URL + environment) |
| `/projects/[projectId]` | Project detail: module list, "Discover whole site" |
| `/modules` | All modules across the user's projects |
| `/modules/[moduleId]` | Module detail / hub |
| `/modules/[moduleId]/config` | Credentials + test data |
| `/modules/[moduleId]/discovery` | Live discovery control room |
| `/modules/[moduleId]/review` | Workflows + generated test cases |
| `/modules/[moduleId]/report` | Printable report |

### Demo target app (`:4000`)

A lab-materials management app used as the system under test:
`/`, `/login`, `/dashboard`, `/materials`, `/materials/new`, `/materials/:code`,
`/materials/:code/submit|approve|reject`, `/review`, `/approvals`,
`/reports`, `/reports/generate`, `/reports/:id`.

It exists to give discovery something realistic to crawl — an auth form, CRUD
forms, and role-gated approval flows.

---

## Quickstart

```bash
pnpm install

# configure apps/web/.env, apps/worker/.env, packages/db/.env
# (see docs/configuration.md — DATABASE_URL, REDIS_URL, AUTH_SECRET, ...)

pnpm db:migrate && pnpm db:seed            # against your Neon unpooled URL
docker compose -f docker/docker-compose.yml up -d redis
pnpm --filter @repo/worker exec playwright install chromium
```

Then start everything — web + worker + demo app — with one command:

```bash
pnpm dev
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:3000 |
| Demo target app | http://localhost:4000 |
| Worker | no UI — consumes the discovery and test-run queues |

Log in with **demo@autotest.dev / demo1234**.

Or run them separately:

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:worker   # REQUIRED — sessions stay QUEUED without it
pnpm dev:demo     # http://localhost:4000 — the app under test
```

---

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Web + worker + demo-app in parallel (recommended) |
| `pnpm dev:web` / `dev:worker` / `dev:demo` | Run a single service |
| `pnpm db:generate` | Drizzle schema → migration SQL |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Demo data |
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest per workspace |
| `pnpm build` | Workspace build |

---

## Data model

18 tables, defined in `packages/db/src/schema/`:

| File | Tables |
| --- | --- |
| `auth.ts` | `users` |
| `project.ts` | `projects`, `modules` |
| `config.ts` | `credentials` (encrypted), `test_data_sets` |
| `discovery.ts` | `discovery_sessions`, `discovered_pages`, `discovered_elements`, `discovered_actions`, `state_transitions`, `discovery_logs` |
| `artifacts.ts` | `discovery_artifacts` |
| `workflow.ts` | `workflows`, `workflow_steps`, `test_cases`, `test_case_steps`, `test_runs`, `test_run_results` |

Hierarchy: `users → projects → modules → { discovery_sessions, workflows,
test_cases, test_runs }`.

> **Note on the dev database:** it currently carries 12 tables with no Drizzle
> definition — `refresh_tokens` and an orphaned cinema/movie-booking demo
> (`cinemas`, `cities`, `movies`, `orders`, `order_items`, `payments`,
> `profiles`, `screens`, `seat_inventory`, `seats`, `showtimes`) from earlier
> iterations. They are unused by the app and safe to drop:
> `DROP TABLE refresh_tokens, cinemas, cities, movies, orders, order_items, payments, profiles, screens, seat_inventory, seats, showtimes;`

---

## REST API

All responses use the envelope `{ data, meta, error }`; input validated with Zod;
errors raised as `AppError`.

```
POST   /api/auth/signup · POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me

GET|POST            /api/projects
GET|PATCH|DELETE    /api/projects/[projectId]
GET                 /api/projects/[projectId]/detail
POST                /api/projects/[projectId]/discover
GET|POST            /api/projects/[projectId]/modules

GET|PATCH|DELETE    /api/modules/[moduleId]
POST                /api/modules/[moduleId]/discover
GET                 /api/modules/[moduleId]/discovery
GET|POST            /api/modules/[moduleId]/credentials
GET|PATCH|DELETE    /api/modules/[moduleId]/credentials/[credentialId]
GET|POST            /api/modules/[moduleId]/test-data
GET|POST            /api/modules/[moduleId]/workflows
GET|PATCH|DELETE    /api/modules/[moduleId]/workflows/[workflowId]
GET|POST            /api/modules/[moduleId]/test-cases
GET|PATCH|DELETE    /api/modules/[moduleId]/test-cases/[testId]
GET|POST            /api/modules/[moduleId]/test-runs
GET                 /api/test-runs/[testRunId]
GET                 /api/modules/[moduleId]/report
GET                 /api/health
GET|PUT             /api/storage/[...key]        GET /storage/[...key]
```

---

## Repository layout

```
apps/web/         Next.js 15 management UI + API (:3000)
apps/worker/      BullMQ consumer: discovery → workflows → test cases → test runs
apps/demo-app/    Demo target app (:4000) — lab materials management
packages/core/    Queue, storage, errors, action safety, logging
packages/db/      Drizzle schema, migrations, seed
packages/schemas/ Shared Zod contracts
packages/browser/ Playwright: collection, detection, analysis, redaction
packages/ai/      mock / local / OpenAI adapters
```

---

## Security model
- Secret-bearing env vars are git-ignored and app-scoped.
- Credentials encrypted with AES-256-GCM; decrypted only inside the worker.
- Screenshots are captured **after** DOM masking of sensitive inputs, in both
  discovery and test execution.
- Production projects are blocked from discovery and test runs; destructive and
  logout actions are never executed.
- API enforces session auth, module access, same-origin CSRF, Zod validation and
  bcrypt password hashing (cost 12).

---

## Status

Working and verified end to end:
- Flattened `Project → Module` model, automatic whole-site provisioning.
- Discovery with live logs, streamed counters and masked screenshots.
- Workflow + test case generation (23-case auth matrix, 5-case generic baseline).
- Test execution with pass/fail/skip, per-case screenshots and run totals.

Still to do:
- Review UI for the test-run grid (totals, pass rate, screenshot lightbox).
- CSV import/export endpoints wired to the grid.
- Test totals and screenshot gallery on the report page.
- Unit tests for the worker packages (`packages/core`, `packages/schemas`,
  `packages/db` currently have no test files, so `pnpm -r test` exits 1).
