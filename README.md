# Autotest SaaS — Autonomous Web Application Testing Platform

Point it at a web app. It drives a real Chromium browser, discovers the app's
pages, forms and actions on its own, generates a full manual-style test matrix
from what it finds, then **executes** that matrix and reports pass/fail counts
with a screenshot for every case.

Postgres runs on **Neon**, Redis in **Docker**, everything else is
pnpm-workspace TypeScript.

## Documentation

| Document | What it covers |
| --- | --- |
| [tech-stack](docs/tech-stack.md) | Stack, architecture diagram, workflows, data model, and the verified Gemini/Jev integration status |
| [requirements](docs/requirements.md) | Full feature matrix with per-item implementation status, and the 32-step acceptance scenario |
| [user manual](docs/user-manual.md) | How to actually use it: projects, modules, credentials, discovery, runs, reports, troubleshooting |
| [features](docs/features.md) | Feature inventory with status |
| [architecture](docs/architecture.md) | Deeper package and schema breakdown |
| [configuration](docs/configuration.md) | Environment variables |
| [example flows](docs/example-flows.md) | Walkthrough of a full run |

> ⚠️ **AI and Jev are wired but off by default.** `AI_PROVIDER` defaults to
> `mock`, which makes every AI path a no-op; Jev stays dormant until
> `TYPESAFE_API_KEY` is set. Both are advisory: neither decides pass/fail, and
> the deterministic pipeline runs unchanged with no keys. Live calls against
> real Gemini/Grok/OpenAI/Jev endpoints are **unverified** — no keys are
> configured in this environment. See [Status](#status).

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
  flag. Production projects skip **automatic** discovery; manual per-module
  discovery and test runs are **not** blocked (see [Security model](#security-model)).
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
- **Data-driven expansion** — a case linked to a CSV dataset
  (`test_cases.dataset_id`) runs once per row: `{{column}}` tokens are
  substituted, `dataset_id` / `dataset_row` are recorded on each result, the
  `testData` column shows the row's actual values, and the screenshot key gets a
  `-row-N` suffix. A dataset that is missing, empty or non-CSV logs a warning
  and the case runs once unchanged rather than silently dropping out of the run.
  (Linking a case to a dataset is SQL-only today — see §9.)
- `GET /api/test-runs/[testRunId]` returns the run, its totals and every result
  with a resolved screenshot URL.

### 8. Review & reporting
- `/modules/[moduleId]/review` — browse discovered workflows and generated test
  cases; approve/edit via the `workflows/*` and `test-cases/*` APIs.
- `GET /api/modules/[moduleId]/report` — per-module discovery summary.
- `GET /api/modules/[moduleId]/report/export?format=json|html|csv|junit` —
  up to 50 runs, session + module guarded. **API-only; no UI links to it** (the
  report page's "Download JSON" button serialises the open run client-side).
- `/modules/[moduleId]/report` — printable report styling.

### 9. CSV data-driven testing
> ⚠️ **Partially usable.** The worker side is done: a case bound to a CSV
> dataset expands to **one result per row**, `{{column}}` tokens are substituted
> into step targets and values, and each result carries `dataset_id` +
> `dataset_row` with a `row N` badge in the grid and report (screenshots get a
> `-row-N` suffix). What is missing is the way in: **no API or UI can set
> `test_cases.dataset_id`** (`UpdateTestCaseInputSchema` has no such field), so
> binding a case to a dataset requires direct SQL. Also broken today: saving a
> `KEY_VALUE` dataset from the UI fails validation (client sends an object, the
> schema expects a string), and `DELETE /api/test-data?id=…` chains two
> `.where()` calls — drizzle *replaces* rather than ANDs — so it deletes **every**
> dataset in the module. The RFC 4180 parser in `apps/web/lib/test-cases/csv.ts`
> still has zero importers, and the `GOTO … | FILL …` DSL below has no parser and
> no consumer. See `docs/requirements.md` §9.
>
> ```
> GOTO http://localhost:4000/login | FILL role:email a@b.c | SUBMIT role:submit | VERIFY stayed_on_page
> ```

Dataset rows are parsed server-side on upload (`normaliseTestDataSetInput`),
which rejects a header-only CSV with 400. The UI's own check is still just
`text.includes(",")`.

`VERIFY` accepts `navigated_away`, `stayed_on_page`, `error_message`,
`app_responsive`, `attr:<target>:<attribute>=<value>`, and
`any_of:<expectation>,<expectation>`.

### 10. Health & evidence storage
- `GET /api/health` — Neon query latency + Redis ping → `ok` / `degraded`.
- **Local** driver (default) shares `../data/storage` between web and worker;
  evidence is served via `/storage/[...key]`.
- **S3** driver (aws-sdk v3, custom endpoint + `forcePathStyle` for Neon S3).

### 11. AI augmentation — wired, off by default
`packages/ai` ships five providers behind one `AIProvider` interface —
`mock` (the default), `openai`, `gemini`, `grok`, `local` — selected by
`AI_PROVIDER` through `createAIProvider()`. Gemini is hand-rolled REST
(`generateContent`), not the Google SDK, matching the no-SDK convention of the
OpenAI-compatible adapter. `sanitize.ts` redacts credential-shaped values from
every outbound context, inside each provider as well as at the worker and web
boundaries.

Three call sites, all advisory and all no-ops when the provider is `mock`:

| Call site | What it does |
| --- | --- |
| `interpretPageWithFallback` (`discovery/runner.ts:456`) | Interprets each discovered page with a 15s timeout; falls back to the deterministic heuristic on error/timeout/malformed output. Stored as `ai_page_type` / `ai_purpose` / `ai_source`. |
| `enrichWithAiAnalysis` (`workflows/builder.ts:142`) | Analyses built workflows and **logs** the result. Never turned into executable steps. |
| `createAiCaseGenerator` (`test-generation/generator.ts:39`) | Suggests extra cases per page (max 10 pages/run, 45s timeout), grounded on discovered elements; suggestions referencing unknown elements are dropped. Stored with `source = "ai"`. |

Deterministic generation still runs regardless, so the pipeline is complete with
no key. `GET|POST /api/modules/[moduleId]/ai` serves the application model and
page interpretation with a server-rebuilt, sanitized context — **the UI does not
call it yet**. Test-case generation's deterministic path never consults a model.

**Jev (TypeSafe System One)** is likewise wired: `TYPESAFE_API_KEY` enables
`createJevAgent`, used in discovery for unfamiliar logins and the
irreversible-action guard, and in execution as the last step of the locator
fallback chain (`processor.ts:53` → `ctx.resolver` → `waitForLocator`). Unset,
every hook is a no-op. See [Status](#status) for what remains unverified.

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

26 tables, defined in `packages/db/src/schema/`:

| File | Tables |
| --- | --- |
| `auth.ts` | `users` |
| `project.ts` | `projects`, `modules` |
| `config.ts` | `credentials` (encrypted), `test_data_sets` |
| `discovery.ts` | `discovery_sessions`, `discovered_pages`, `discovered_elements`, `discovered_actions`, `state_transitions`, `discovery_logs`, `ui_states`, `navigation_edges` |
| `artifacts.ts` | `discovery_artifacts` |
| `workflow.ts` | `workflows`, `workflow_steps`, `test_cases`, `test_case_steps`, `test_runs`, `test_run_results` |
| `environment.ts` | `environments` |
| `coverage.ts` | `coverage_targets`, `coverage_links`, `coverage_records` |
| `findings.ts` | `finding_groups`, `findings` |

Hierarchy: `users → projects → modules → { discovery_sessions, workflows,
test_cases, test_runs }`.

> The last three files (`environment`, `coverage`, `findings` — migration
> `0013`) are **schema-only today**: no application code reads or writes them.
> The coverage numbers on the report page are computed from `test_runs` /
> `test_run_results`, not from `coverage_records`.

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
GET|POST            /api/modules/[moduleId]/test-data        (DELETE ?id=… too)
GET|POST            /api/modules/[moduleId]/workflows
GET|PATCH|DELETE    /api/modules/[moduleId]/workflows/[workflowId]
GET|POST            /api/modules/[moduleId]/test-cases
GET|PATCH|DELETE    /api/modules/[moduleId]/test-cases/[testId]
GET|POST            /api/modules/[moduleId]/test-runs
GET|POST            /api/modules/[moduleId]/ai                application model + page interpretation
GET                 /api/test-runs/[testRunId]
GET                 /api/modules/[moduleId]/report
GET                 /api/modules/[moduleId]/report/export?format=json|html|csv|junit
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
packages/ai/      AIProvider: mock / openai / gemini / grok / local + Jev client
```

---

## Security model
- Secret-bearing env vars are git-ignored and app-scoped.
- **SSRF guard on project base URLs** — `assertTargetUrlAllowed`
  (`packages/core/url-guard.ts`) rejects non-http(s) schemes, embedded
  credentials and private/loopback/link-local/metadata hosts at project create
  and update. `ALLOW_PRIVATE_TARGETS=true` is the local-dev escape hatch
  (defaults `false`, so `pnpm dev` against `localhost` needs it set; it is
  **not** in `.env.example`). The guard does **not** cover worker navigation —
  `page.goto` is unguarded — and `assertSafeFetch` has no caller.
- Credentials encrypted with AES-256-GCM; decrypted only inside the worker.
- AI contexts are redacted (`packages/ai/sanitize.ts`) before any outbound
  request; credential tokens stay `{{username}}` / `{{password}}` in step data.
- Screenshots are captured **after** DOM masking of sensitive inputs, in both
  discovery and test execution.
- **Production is only half-guarded** — project creation skips auto-discovery
  for `environment = "production"` and records a `productionConfirmed`
  acknowledgement, but per-module discovery and **test-run creation have no
  environment check at all** (see `requirements.md` §7.18). Destructive and
  logout actions are never executed during discovery.
- API enforces session auth, module access, same-origin CSRF, Zod validation and
  bcrypt password hashing (cost 12).

---

## Status

Verified working end to end:
- `Project → Module` model (the `Application` entity was deliberately removed),
  automatic whole-site provisioning.
- Discovery with live logs, streamed counters, masked screenshots, hard scope
  guard, and budget enforcement.
- Application model: sessions, pages, elements, actions, state transitions, plus
  route patterns / page fingerprints, `ui_states` and `navigation_edges`.
- Workflow derivation and test case generation — 23-case auth matrix, generic
  and commerce builders. Re-discovery reconciles instead of duplicating, and
  never overwrites hand-authored cases.
- Encrypted module credentials, with `{{username}}` / `{{password}}` runtime
  substitution and screenshot masking.
- Test execution with pass/fail/skip, async-aware assertions, per-case
  screenshots, run totals, live polling and URL-synced run selection.
- **Data-driven execution** (working tree): CSV-bound cases expand to one result
  per row with `{{column}}` substitution, row numbers surfaced in the grid and
  report.
- **AI providers** — `mock` / `openai` / `gemini` / `grok` / `local`, redaction,
  and three advisory call sites (page interpretation, workflow analysis, extra
  case suggestions). Off by default.
- **Jev** — `TYPESAFE_API_KEY` enables login assist and the irreversible-action
  guard in discovery, and the locator fallback in execution.
- **SSRF guard** on project base URLs, with `ALLOW_PRIVATE_TARGETS` for local
  development.
- Reporting: run summaries, coverage, counter-drift detection, inline evidence,
  print/PDF, JSON export, paginated results grid, run deletion, and multi-format
  export (`json | html | csv | junit`) via the report export API.
- Health endpoint, local and S3 storage drivers, run/report/delete APIs.
- Dark-only UI; 19 test files / 172 tests, all green.

Verified **not** working (see `docs/requirements.md` for the full matrix):
- **AI and Jev live calls** — wired but unverified: no `GEMINI_API_KEY`,
  `XAI_API_KEY` or `TYPESAFE_API_KEY` configured here. Both are advisory and
  no-op when unset (`AI_PROVIDER` defaults to `mock`).
- **CSV binding** — the worker expands CSV rows, but nothing can set
  `test_cases.dataset_id`: no API field, no UI. Also `KEY_VALUE` dataset saves
  fail validation, and dataset `DELETE` removes every dataset in the module
  (two chained `.where()` calls). The RFC 4180 parser in
  `apps/web/lib/test-cases/csv.ts` still has zero importers and the
  `GOTO|FILL|VERIFY` DSL has no parser.
- **Approval** — statuses are modelled and the PATCH API works, but no UI writes
  them and the executor ignores them.
- **Video / trace / console logs** — no capture code at all; only screenshots.
- **Retries, rerun-failed, parallel execution, per-case selection** — execution
  is serial with `TEST_RUN_ATTEMPTS = 1` hardcoded.
- **Project-scoped credentials** — still module-scoped; the migration is
  approved but not done.
- **Incremental discovery** — every run is a full crawl.
- **Coverage and findings tables** — the engines are computed and unit-tested,
  but never called from a run, so no rows are written; `environments` is
  likewise unread.
- **AI / export UI** — `/api/modules/[id]/ai` and `/report/export` have no UI
  consumer.
- **`/storage/[...key]` is unauthenticated** — a real issue if screenshots are
  sensitive.
- **`pnpm -r test` exits 1** — not a failing test: `@repo/db` declares
  `"test": "vitest run"` with zero test files, so vitest exits 1 and pnpm
  aborts the run. Every other workspace passes (172 tests).
