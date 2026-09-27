# Tech Stack

Stack, architecture diagram, and the end-to-end workflows that run on it.

- [Stack](#stack)
- [Architecture diagram](#architecture-diagram)
- [Workflows](#workflows)
- [Dependency ownership](#dependency-ownership)
- [Why these choices](#why-these-choices)
- [Browser engines](#browser-engines)

---

## Stack

| Area | Choice | Notes |
| --- | --- | --- |
| Monorepo | pnpm workspaces 9.12 | `apps/*` + `packages/*` |
| Language | TypeScript 5.9 (strict, `noUncheckedIndexedAccess`) | One language across the whole stack |
| Runtime | Node 24 LTS | ESM throughout |
| Web | Next.js 15 (App Router) | Port **3000**; Server Components + client features |
| UI | React 19 | |
| API | Next.js Route Handlers | Envelope `{ data, meta, error }`, central `route()` wrapper |
| Data fetching | TanStack React Query 5 | `features/hooks.ts` + per-feature queries |
| Forms | React Hook Form 7 + `@hookform/resolvers` + Zod | |
| Styling | Tailwind CSS 3.4 | `tailwindcss-animate`; `next-themes` for dark mode |
| Components | Radix UI primitives + `class-variance-authority`, `tailwind-merge` | shadcn-style `components/ui` |
| Toasts | `sonner` | |
| Icons | `lucide-react` | |
| Worker runtime | `tsx` (ESM) | Long-lived BullMQ consumer |
| Browser automation | Playwright 1.49 | Chromium, headless by default |
| Queue | BullMQ 5 + ioredis 5 | Two queues: `discovery`, `test-run` |
| Database | PostgreSQL via **Neon** (serverless) | Drizzle ORM 0.38 |
| Driver | `postgres` (postgres.js) 3.4 | |
| Migrations | Drizzle Kit 0.30 | `pnpm db:generate` / `db:migrate` |
| Validation | Zod 3 | Shared contracts in `@repo/schemas` |
| Auth | Session cookie, hand-rolled | `AUTH_SECRET`-signed; bcryptjs for passwords |
| Token signing | `jose` 5 | |
| Encryption | Node `crypto` AES-256-GCM | Module credential secrets at rest |
| Object storage | Local filesystem or S3-compatible | `forcePathStyle` for Neon S3; served via `/storage/*` |
| AI | Adapter: `mock` / `local` / `openai` | Deterministic fallback, AI optional |
| Logging | Pino 9 | `createChildLogger`, secret-free |
| Testing | Vitest 2.1 | |
| Linting | ESLint 9 flat config | |
| Infra | Docker Compose | Redis; Dockerfiles for web/worker/demo |

---

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (user)                                    │
│                     http://localhost:3000  ·  dark mode                      │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ HTTP
┌───────────────────────────────────▼──────────────────────────────────────────┐
│  apps/web — Next.js 15 App Router                    :3000                    │
│                                                                              │
│  app/(auth)/login · signup        app/(app)/projects · modules · config      │
│                                          · discovery · review · report      │
│                                                                              │
│  app/api/**  ── route() wrapper ──▶ { data, meta, error }                    │
│      guards: requireSession() · requireModuleAccess() · assertSameOrigin()   │
│      validate: Zod (@repo/schemas)         errors: AppError (@repo/core)      │
└───────┬──────────────────────────────────────────────┬───────────────────────┘
        │ Drizzle queries                              │ put / get
        ▼                                              ▼
┌───────────────────────┐                 ┌──────────────────────────────┐
│  Neon PostgreSQL      │                 │  Evidence storage            │
│  18 tables             │                │  local ./data/storage  |     │
│  users → projects →   │                 │  S3 / Neon S3 (path-style)   │
│  modules → discovery  │                 └──────────────────────────────┘
│  workflows, test_cases │                          ▲
│  test_runs             │                          │ put (masked PNG)
└───────────┬───────────┘                          │
            │ Drizzle                               │
            │                                       │
            │   ┌───────────────────────────────────┴────────────────────────┐
            │   │                        Redis  (Docker)                    │
            │   │   queue "discovery"        queue "test-run"               │
            │   └───────────────┬───────────────────────┬───────────────────┘
            │                   │ BullMQ job           │ BullMQ job
            │                   ▼                       ▼
            │   ┌───────────────────────────────────────────────────────────┐
            └���──▶│  apps/worker — tsx ESM consumer                          │
                │                                                           │
                │  DISCOVERY PIPELINE            TEST-RUN PIPELINE         │
                │  ├ scope guard (hard)          ├ load cases               │
                │  ├ chromium.launch             ├ fresh context per case   │
                │  ├ login with credential       ├ resolve locator hints    │
                │  ├ analyze page (AI optional)  ├ perform steps            │
                │  ├ build action space          ├ evaluate expectation     │
                │  ├ pick safe action            ├ screenshot (masked)      │
                │  ├ execute + screenshot        └ persist result           │
                │  ├ persist write-ahead                                     │
                │  ├ buildWorkflows()                                         │
                │  └ generateTestCases()  ── 23-case auth matrix             │
                └───────────────────────────┬───────────────────────────────┘
                                            │ Playwright drives
                                            ▼
                            ┌────────────────────────────────┐
                            │  apps/demo-app — Express  :4000 │
                            │  lab materials under test       │
                            │  /login /materials /review      │
                            │  /reports /approvals            │
                            └────────────────────────────────┘
```

Shared library layer consumed by both runtimes:

| Package | Responsibility |
| --- | --- |
| `@repo/core` | BullMQ queue + worker factories, Redis connections, `StorageProvider` (local/s3), `AppError`, action-safety classification, Pino logging, AES-256-GCM `CredentialCrypto` |
| `@repo/db` | Drizzle client, schema, migrations, seed |
| `@repo/schemas` | Zod contracts shared by web + worker |
| `@repo/browser` | Playwright wrappers: element collection, action/navigation detection, page classification, locator resolution, DOM masking |
| `@repo/ai` | `AiProvider` adapters (`mock`, `local`, `openai`) |

---

## Workflows

### 1. Project creation → automatic discovery

```
user                web API                    Postgres         Redis        worker
 │                     │                           │               │            │
 │ POST /api/projects  │                           │               │            │
 ├────────────────────▶│                           │               │            │
 │                     │ requireSession            │               │            │
 │                     │ assertSameOrigin          │               │            │
 │                     │ Zod parse                 │               │            │
 │                     ├─ INSERT project ─────────▶│               │            │
 │                     │                           │               │            │
 │                     │ provisionProjectDiscovery │               │            │
 │                     │  ├ find/create "Whole site" module       │            │
 │                     ├─ INSERT module ──────────▶│               │            │
 │                     │  ├ INSERT session (QUEUED)──────────────▶│            │
 │                     │  ├ queue.add ───────────────────────────▶│            │
 │                     │  └ module → DISCOVERING ──▶│               │            │
 │ 201 { project,      │                           │               │            │
 │       moduleId,     │                           │               │            │
 │       sessionId }   │                           │               │            │
 │                     │                           │               │  ◀── job ──┤
 │                     │                           │               │            │
 │                     │                           │◀── run pipeline ─────────┤
```

Production projects are rejected before any of this: no module, no job.

### 2. Discovery session

```
runDiscovery
 ├─ load context (module, project, credentials, test data, budgets)
 ├─ chromium.launch (headless, isolated context)
 ├─ authenticate with the chosen role's encrypted credential
 ├─ for each page, until budget exhausted:
 │    ├─ scope guard ── out-of-scope nav?  skip + log (auth redirects excepted)
 │    ├─ snapshotPage()          @repo/browser   element collection
 │    ├─ analyzeCurrentPage()    @repo/browser   page type, name, heading
 │    ├─ buildActionSpace()      indexed + deduped candidate actions
 │    ├─ decideOneAction()       scored; blocked/destructive/logout excluded
 │    ├─ execute action          resolveLocator() → fill / click / select
 │    ├─ recordEvidence()        mask secrets → screenshot → storage
 │    └─ persist                 page, element, action, transition, log
 ├─ buildWorkflows()           form + navigation workflows  (DRAFT)
 └─ generateTestCases()        23-case auth matrix / 5-case generic baseline
```

Every write is **write-ahead** so `/discovery` can stream progress live.

### 3. Test case generation

```
page + discovered controls
   │
   ├─ classifyFields()  ── role: email | password | text | select | checkbox | radio | submit
   │
   ├─ isAuthForm()?  (email AND password present)
   │     yes ─▶ buildAuthScenarios()   23 cases across 5 categories
   │     no  ─▶ buildGenericScenarios()  5 baseline cases
   │
   └─ each case → { name, type, priority, testData, expectedResult, steps[] }
                    │
                    └─ steps carry locator hints (role:email, role:submit)
                       and, when machine-checkable, an `expect` on the VERIFY step
```

Cases with no machine-checkable expectation (whitespace policy, show/hide
toggle) are stored **without** `expect` and report as `SKIP` — never as a pass.

### 4. Test execution

```
POST /api/modules/[moduleId]/test-runs
  1. guards + module access
  2. INSERT test_runs (QUEUED)
  3. queue.add → "test-run"

worker: processTestRunJob
  4. run → RUNNING
  5. load every test case for the module
  6. launch chromium once
  7. for each case, in a FRESH browser context:
       ├─ perform action steps (GOTO / FILL / PRESS / CLICK / SUBMIT)
       ├─ evaluate the VERIFY expectation
       │    navigated_away · stayed_on_page · error_message_present
       │    input_attribute · app_responsive · any_of(…)
       ├─ mask secrets → screenshot → storage (modules/{id}/runs/{runId}/)
       └─ INSERT test_run_results (PASS | FAIL | SKIP, duration, actual, error)
  8. run → COMPLETED with totals (total / passed / failed / skipped)

GET /api/test-runs/[testRunId]
  9. run + results joined to case names + resolved screenshot URLs
```

One result row per case, and a case that throws mid-execution is recorded as
`FAIL` with the error rather than aborting the run.

### 5. Evidence storage

```
discovery   modules/{moduleId}/sessions/{sessionId}/page-N.png
                                     /action-{ts}-{rand}.png
test runs   modules/{moduleId}/runs/{runId}/{case-slug}.png
```

Served back through `/storage/[...key]` (public) and `/api/storage/[...key]`
(guarded). The S3 driver forces path-style addressing, which Neon S3 requires.

---

## Dependency ownership

Because pnpm resolves strictly, every package that imports a runtime dependency
declares it directly:

- `apps/web` imports `drizzle-orm` (route queries), `ioredis` (health ping) and
  `bullmq` (queueing) — all declared as deps of `@repo/web`.
- `apps/worker` imports `bullmq`, `playwright` and `drizzle-orm` — declared as
  deps of `@repo/worker`.
- `@repo/core` owns queue, storage, crypto, errors and logging.
- `@repo/browser` owns **all** Playwright page interaction for discovery.
- `@repo/db` owns schema, migrations and client.

One deliberate exception: the test executor has its own locator resolver
(`apps/worker/src/test-execution/locators.ts`) rather than reusing
`@repo/browser`'s `resolveLocator`. The contracts differ — the shared resolver
requires a *unique* semantic match from discovery hints, while generated cases
need role-based, ordinal-aware, first-visible resolution. Merging them would
mean changing behaviour for the discovery path.

---

## Why these choices

- **Neon Postgres** — serverless branching makes it easy to snapshot a database
  before a destructive migration or a discovery run against a live app.
- **Redis + BullMQ** — discovery and test execution are long, browser-bound and
  must survive a web restart. A queue with retries and a visible `QUEUED` state
  is far easier to reason about than in-process work.
- **Playwright** — the only piece that can honestly answer "did the app reject
  this login", which is the whole point of the execution step.
- **Deterministic-first AI** — `AI_PROVIDER=mock` makes the entire pipeline
  reproducible and testable. AI upgrades heuristics; it is never on the
  critical path.
- **Portable locator hints** — storing a snapshot CSS selector in a test case
  guarantees the case breaks on the next redesign. Role hints keep cases alive.
- **SKIP over false PASS** — a suite that cannot verify an outcome reports
  `SKIP`. Inflating the pass rate with unverifiable cases is the failure mode
  that makes automated testing untrustworthy.

---

## Browser engines

Chromium is downloaded via Playwright, not bundled in the repo. Install once per
environment:

```bash
pnpm --filter @repo/worker exec playwright install chromium
```
