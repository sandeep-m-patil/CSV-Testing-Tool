# Tech Stack

Stack, architecture, and the end-to-end workflows that run on it.

**This document reflects verified code state as of the last audit.** Where a
component is planned but absent, it says so. See
[`requirements.md`](./requirements.md) for the full status matrix.

- [Stack](#stack)
- [AI and agent integration status](#ai-and-agent-integration-status)
- [Architecture diagram](#architecture-diagram)
- [Workflows](#workflows)
- [Evidence storage](#evidence-storage)
- [Data model](#data-model)
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
| Encryption | Node `crypto` AES-256-GCM | Credential secrets at rest |
| Object storage | Local filesystem or S3-compatible | `forcePathStyle` for Neon S3; served via `/storage/*` |
| Logging | Pino 9 | `createChildLogger`, secret-free |
| Testing | Vitest 2.1 | **1 test file in the repo** |
| Linting | ESLint 9 flat config | |
| Infra | Docker Compose | Redis; Dockerfiles for web/worker/demo |

### Not in the stack

These are required by the target design but **are not dependencies of this
repository today**:

| Component | State | Note |
| --- | --- | --- |
| Gemini SDK (`@google/genai`) | **Absent** | No Gemini/Google AI package, no `GEMINI_API_KEY`. |
| Jev (`jev-ultrafast` / `@tontoko/jev-browser`) | **Absent** | No Jev package, no TYPESAFE/TypeSafe key. |
| `csv-parse` / `papaparse` | **Absent** | Hand-rolled RFC 4180 in `apps/web/lib/test-cases/csv.ts`, and unreachable. |

---

## AI and agent integration status

This section exists because earlier versions of these docs overstated what the
AI layer does. It is the most misunderstood part of the codebase.

### `@repo/ai` — the seam exists and is unused

`packages/ai` provides a real `AIProvider` interface, a factory, a deterministic
`MockProvider`, and an OpenAI-compatible adapter built on raw `fetch` (no SDK
dependency). The interface methods are `interpretPage()` and `analyzeWorkflows()`.

**Neither method has a single call site.** The provider is constructed at
`apps/worker/src/discovery/runner.ts:107` and the only property ever read is
`.label`, in a log string. Every heuristic in the discovery pipeline is
deterministic and unconditional.

Consequences worth being precise about:

- "AI augments discovery" is **false** today. There is no augmentation.
- `AI_PROVIDER=openai` currently produces **no behavioural difference**.
- `@repo/web` lists `@repo/ai` in `transpilePackages` but does not depend on it,
  and exposes no AI route.

### Gemini — not implemented

A clean drop-in. Implementing it means adding a `GeminiProvider` to
`packages/ai` that satisfies the same interface, plus a `gemini` case in the
factory, plus actually calling the interface at the points where heuristics
currently make the decision. Two things must land alongside it:

1. **Redaction.** The discovery page snapshot must have secrets stripped before
   it leaves the worker. Steps already carry `{{username}}` / `{{password}}`
   placeholders, so the safe path exists — it just has to be enforced.
2. **Validation.** Zod schemas for AI output already exist in `@repo/schemas`
   but no generator consumes them. Wire them in the same change.

### Jev Ultrafast — not implemented

`browser-use/jev-ultrafast` is real and MIT licensed. Integrating it is not a
matter of adding a file. Verified constraints:

1. **It is Python** (`uv sync`, `from jev_ultrafast import Agent`). This
   codebase is TypeScript. A sidecar process plus an IPC boundary is required
   for the upstream package.
2. **It drives real Chrome over CDP** via Browser Use's "Browser Harness" — not
   Playwright. The intended diagram, where Jev and Playwright drive the same
   page, does not match upstream behaviour. The Node port
   **`@tontoko/jev-browser`** wraps an existing Playwright `page` and keeps
   native assertions available, and is the correct bridge for this repository.
3. **It transmits visible page text to its decision model on every step.** After
   authentication that text includes customer data. This collides with the
   "secrets never leave the platform" rule and needs an explicit redaction
   decision before any integration ships.
4. It requires `TYPESAFE_API_KEY` plus an OpenAI-compatible text-model key.

The intended fallback chain, none of which exists yet:

```text
structured target
  → semantic locator (Playwright)      ← exists today
  → Jev dynamic resolution             ← MISSING
  → FAIL with diagnostic              ← exists today
```

The final rung is deliberate: a target that cannot be resolved fails loudly
rather than being silently skipped.

### What the system does without either

Everything else is real and works: discovery, the application model, workflow
derivation, deterministic test-case generation, execution, assertions,
screenshots and reporting. Neither AI nor Jev is on the critical path, and
neither is stubbed out to look present.

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
│  projects → modules   │                 │  local ./data/storage        │
│  → discovery_*        │                 │  S3 / Neon S3 (path-style)   │
│  → test_cases/runs    │                 └──────────────────────────────┘
└───────────┬───────────┘                          ▲
            │ Drizzle                               │ put (masked PNG)
            │                                       │
            │   ┌───────────────────────────────────┴────────────────────────┐
            │   │                        Redis  (Docker)                    │
            │   │   queue "discovery"        queue "test-run"               │
            │   └───────────────┬───────────────────────┬───────────────────┘
            │                   │ BullMQ job           │ BullMQ job
            │                   ▼                       ▼
            │   ┌───────────────────────────────────────────────────────────┐
            └───▶│  apps/worker — tsx ESM consumer                          │
                │                                                           │
                │  DISCOVERY PIPELINE            TEST-RUN PIPELINE         │
                │  ├ scope guard (hard)          ├ load ALL module cases   │
                │  ├ chromium.launch             │   (no status filter)    │
                │  ├ login with credential       ├ fresh context per case   │
                │  ├ snapshotPage()              ├ resolve locator hints    │
                │  │   ⚠ AIProvider constructed ├ perform steps            │
                │  │     but NEVER invoked      ├ substitute {{tokens}}    │
                │  ├ build action space          ├ poll expectation ≤10s    │
                │  ├ pick safe action            ├ screenshot (masked)      │
                │  ├ execute + screenshot        └ INSERT result row        │
                │  ├ persist write-ahead                                     │
                │  ├ buildWorkflows()                                         │
                │  └ generateTestCases()  ── 23-case auth matrix             │
                └───────────────────────────┬───────────────────────────────┘
                                            │ Playwright drives
                                            ▼
                            ┌────────────────────────────────┐
                            │  apps/demo-app — Express  :4000 │
                            │  or any reachable target app   │
                            └────────────────────────────────┘

  NOT WIRED INTO ANY PATH:
  ┌──────────────────────────┐  ┌──────────────────────────────────┐
  │ GeminiProvider           │  │ Jev Ultrafast                   │
  │ @google/genai            │  │ @tontoko/jev-browser (Node)     │
  │ GEMINI_API_KEY           │  │ TYPESAFE_API_KEY + text model   │
  │ absent from package.json │  │ absent from package.json        │
  └──────────────────────────┘  └──────────────────────────────────┘
```

Shared library layer consumed by both runtimes:

| Package | Responsibility |
| --- | --- |
| `@repo/core` | BullMQ queue + worker factories, Redis connections, `StorageProvider` (local/s3), `AppError`, action-safety classification, Pino logging, AES-256-GCM `CredentialCrypto` |
| `@repo/db` | Drizzle client, schema, migrations, seed |
| `@repo/schemas` | Zod contracts shared by web + worker |
| `@repo/browser` | Playwright wrappers: element collection, action/navigation detection, page classification, locator resolution, DOM masking |
| `@repo/ai` | `AIProvider` adapters (`mock`, `local`, `openai`). **Constructed, never invoked.** |

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
 │       moduleId,     │                           │               │  ◀── job ──┤
 │       sessionId }   │                           │               │            │
 │                     │                           │◀── run pipeline ─────────┤
```

For `environment = "production"` the project is still created, but the block
above is skipped: no `Whole site` module, no session, no job
(`apps/web/app/api/projects/route.ts:66`). Note that the same guard is **absent
from test-run creation** — `POST /api/modules/[moduleId]/test-runs` has no
environment check, so a production project can be crawled manually via the
per-module discovery route or executed directly. See `requirements.md` §7.18.

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
  │    │     ⚠ AI hook exists here but is not wired
  │    ├─ buildActionSpace()      indexed + deduped candidate actions
  │    ├─ decideOneAction()       scored; blocked/destructive/logout excluded
  │    ├─ execute action          resolveLocator() → fill / click / select
  │    ├─ recordEvidence()        mask secrets → screenshot → storage
  │    └─ persist                 page, element, action, transition, log
  ├─ buildWorkflows()           form + navigation workflows  (DRAFT)
  └─ generateTestCases()        23-case auth matrix / 5-case generic baseline
```

Every write is **write-ahead** so `/discovery` can stream progress live. This is
also the reason discovery is durable when the worker dies mid-crawl.

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
                    ├─ steps carry locator hints (role:email, role:submit)
                    ├─ VERIFY steps carry a machine-checkable `expect`
                    └─ credential values are tokens, never literals:
                         {{username}} / {{password}}
```

This path is **fully deterministic**. There is no model call.

Re-discovery reconciles rather than duplicates: only rows with
`source = 'generated'` are rewritten, and both `test_cases.steps` and the
mirrored `test_case_steps` rows are updated. Hand-authored cases are never
overwritten.

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
     ⚠ no status filter — DRAFT and REJECTED cases execute too
     ⚠ no CSV dataset applied — one result per case, not per row
  6. launch chromium once
  7. for each case, serially, in a FRESH browser context:
       ├─ perform action steps (GOTO / FILL / PRESS / CLICK / SUBMIT)
       ├─ resolve {{username}} / {{password}} from the module credential
       ├─ evaluate the VERIFY expectation, polling up to 10s
       │    navigated_away · stayed_on_page (3s settle) · error_message_present
       │    input_attribute · app_responsive · any_of(…)
       ├─ mask secrets → screenshot → storage (modules/{id}/runs/{runId}/)
       └─ INSERT test_run_results (PASS | FAIL | SKIP, duration, actual, error)
  8. run → COMPLETED with totals (total / passed / failed / skipped)

GET /api/test-runs/[testRunId]
  9. run + results joined to case names + resolved screenshot URLs
```

Known gaps in this path, all tracked in `requirements.md` §7 and §9:
retries (`TEST_RUN_ATTEMPTS = 1`, hardcoded), parallel workers
(`TEST_RUN_CONCURRENCY = 1`, serial loop), rerun-failed, per-row CSV
executions, and a separate `test_executions` entity for attempts.

One result row per case, and a case that throws mid-execution is recorded as
`FAIL` with the error rather than aborting the run.

### 5. Evidence storage

```
discovery   modules/{moduleId}/sessions/{sessionId}/page-N.png
                                      /action-{ts}-{rand}.png
test runs   modules/{moduleId}/runs/{runId}/{case-slug}.png
```

Served back through `/storage/[...key]` (currently **unauthenticated** — see
`requirements.md` §14.9) and `/api/storage/[...key]` (session-guarded). The S3
driver forces path-style addressing, which Neon S3 requires.

`discovery_artifacts.artifact_type` and the Zod enum already allow
`trace` / `video` / `log`, but only `screenshot` is ever written. There is no
`test_artifacts` table at all; test runs carry a bare `screenshot_key` text
column.

---

## Data model

`Project → Module` is the spine. A project **is** the application under test;
migration `0002_flatten_project_application` removed the intermediate
`Application` entity on purpose, and the schema comment in
`packages/db/src/schema/project.ts:5` records why. `environment` is a
`varchar(24)` column on `projects`, not a lookup table.

```text
users ─┬─< projects ─┬─< modules ─┬─< discovery_sessions ──< discovery_pages
       │             │            │        ├──< discovered_elements
       │             │            │        ├──< page_actions ──< state_transitions
       │             │            │        ├──< discovery_artifacts
       │             │            │        └──< discovery_logs
       │             │            ├─< credentials ────────── secret_data (AES-256-GCM)
       │             │            │      ⚠ module_id NOT NULL — project-scope migration approved
       │             │            ├─< test_data_sets ─── data jsonb
       │             │            ├─< workflows
       │             │            └─< test_cases ─┬─< test_case_steps  (mirrors steps jsonb)
       │             │                           └─< test_run_results
       │             ├─< test_runs ────────────────┘
       │             └─< sessions (NextAuth-style app sessions)
       └─< accounts / verifications
```

Two modelling notes that matter for the remaining roadmap:

- `test_case_steps` duplicates `test_cases.steps`. The generator writes both;
  the executor reads only the JSONB. The table exists as the relational
  migration path, not as the source of truth.
- `test_data_sets` has no foreign key to any test or run entity, which is the
  structural reason CSV-driven execution is not yet possible.

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
- **Deterministic-first** — the whole pipeline is reproducible with no API keys
  and no network. This is why the missing AI layer is a gap in capability
  rather than a broken build, and why the `AIProvider` seam is kept even though
  it is currently unwired.
- **Portable locator hints** — storing a snapshot CSS selector in a test case
  guarantees the case breaks on the next redesign. Role hints keep cases alive.
- **SKIP over false PASS** — a suite that cannot verify an outcome reports
  `SKIP`. Inflating the pass rate with unverifiable cases is the failure mode
  that makes automated testing untrustworthy.
- **Fail loudly on unresolved targets** — a silent skip is indistinguishable
  from a pass to a reader of the report.

---

## Browser engines

Chromium is downloaded via Playwright, not bundled in the repo. Install once per
environment:

```bash
pnpm --filter @repo/worker exec playwright install chromium
```

Firefox and WebKit are not selectable; the executor and discovery runner both
hardcode the Chromium channel.
