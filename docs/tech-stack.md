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
| Testing | Vitest 2.1 | **19 test files / 172 tests, all green** (`core` 22, `schemas` 15, `demo-app` 4, `browser` 21, `ai` 25, `web` 10, `worker` 75). Root `pnpm -r test` exits 1 only because `@repo/db` has zero test files. |
| Linting | ESLint 9 flat config | |
| Infra | Docker Compose | Redis; Dockerfiles for web/worker/demo |

### Not in the stack

These are required by the target design but **are not dependencies of this
repository today**:

| Component | State | Note |
| --- | --- | --- |
| Gemini SDK (`@google/genai`) | **Absent** | No Google SDK dependency — Gemini is **hand-rolled REST** (`packages/ai/src/gemini.ts`), gated by `GEMINI_API_KEY`. Live calls untested. |
| Jev (TypeSafe System One) | **Present** | `packages/ai/src/jev.ts` + `apps/worker/src/jev/`; enabled by `TYPESAFE_API_KEY`; wired in discovery and execution. Live calls untested. |
| `csv-parse` / `papaparse` | **Absent** | Server-side RFC 4180 parsing lives in `packages/schemas/src/test-data.ts`; the legacy client parser (`apps/web/lib/test-cases/csv.ts`) is unreachable. |

---

## AI and agent integration status

This section exists because earlier versions of these docs both overstated what
the AI layer does *and* then understated it once it was wired. What follows is
the verified state.

### `@repo/ai` — wired, advisory, off by default

`packages/ai` provides the `AIProvider` interface (`interpretPage`,
`analyzeWorkflows`, `generateTestCases`), a factory, and five kinds selected by
`AI_PROVIDER`:

| Kind | Env gate | Transport |
| --- | --- | --- |
| `mock` (default) | none | In-process regex heuristics, no network. Every AI call site short-circuits here. |
| `openai` | `OPENAI_API_KEY` | Raw `fetch` → `chat/completions` (`gpt-4o-mini`) |
| `gemini` | `GEMINI_API_KEY` | Raw `fetch` → `generateContent`, `responseMimeType: json` (`gemini-2.5-flash`) |
| `grok` | `XAI_API_KEY` | OpenAI-compatible → `https://api.x.ai/v1` (`grok-4.6`) |
| `local` | `LOCAL_AI_BASE_URL` | OpenAI-compatible, no key (e.g. Ollama) |

All outbound contexts pass through `packages/ai/src/sanitize.ts`, which redacts
credential-shaped values (emails, tokens, SSN-like numbers, `key=secret` pairs)
— applied inside every provider as well as at the worker and web boundaries, so
§12.8 of requirements is enforced, not vacuous.

**Three wiring points, all advisory** — nothing the model says becomes a locator
or a PASS/FAIL opinion:

1. `interpretPageWithFallback` (`discovery/ai-enrichment.ts:114`) runs per
   discovered page with a 15s timeout; on error, timeout or malformed output it
   falls back to the deterministic heuristic. The result is persisted as
   `discovered_pages.ai_page_type / ai_purpose / ai_fields / ai_actions /
   ai_source`.
2. `enrichWithAiAnalysis` (`workflows/builder.ts:142`) analyses built workflows
   and **logs** the result only.
3. `createAiCaseGenerator` (`test-generation/ai-generation.ts:28`) may add
   cases beyond the deterministic matrix — up to 10 pages/run, 45s timeout,
   suggestions grounded on discovered elements and dropped when they reference
   something the worker never observed. Stored with `source = "ai"`.

Consequences worth being precise about:

- `AI_PROVIDER=openai|gemini|grok|local` **does** change behaviour; `mock`
  does not. Default is `mock`, so a fresh setup is fully deterministic.
- Live calls are **unverified** — no `GEMINI_API_KEY` / `XAI_API_KEY` in this
  environment; adapters are unit-tested against mocked `fetch` (25 tests).
- `apps/web` depends on `@repo/ai` and serves `GET|POST
  /api/modules/[moduleId]/ai` (server-rebuilt, sanitized context; failure →
  `503 AI_UNAVAILABLE`), but **no UI calls it**.

### Gemini — implemented, unverified

`packages/ai/src/gemini.ts`: `POST {base}/models/{model}:generateContent` with
`responseMimeType: application/json` and the `x-goog-api-key` header. Output is
`.parse()`d against `AiPageInterpretationSchema` / `AiWorkflowAnalysisSchema` /
`parseTestCaseSuggestions`. Redaction enforced at `gemini.ts:100` via
`sanitizePageContext`.

### Jev Ultrafast — implemented via System One, wired

Jev is called directly over TypeSafe System One from TypeScript (see
`docs/requirements.md` §13). No Python sidecar and no second browser: Jev chooses
among elements the worker enumerated, and Playwright acts on the chosen node.

```text
structured target
  → semantic locator (Playwright, polled 3s)
  → Jev dynamic resolution             (TYPESAFE_API_KEY)
  → FAIL with diagnostic
```

`createJevAgent` is built in discovery (`runner.ts:116`) and execution
(`processor.ts:53`); enabled by `TYPESAFE_API_KEY`, a no-op otherwise. Discovery
also uses Jev to recognise and complete login forms the heuristics miss, and to
skip submit-like actions it judges irreversible.

### What the system does without either

Everything else is real and works: discovery, the application model, workflow
derivation, deterministic test-case generation, execution, assertions,
screenshots and reporting. Neither AI nor Jev is on the critical path — the
runtime pivots entirely on `AI_PROVIDER=mock` / unset `TYPESAFE_API_KEY`.

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
                │  │   ▶ AIProvider invoked     ├ perform steps            │
                │  │     (advisory)             ├ substitute {{tokens}}    │
                │  │     AI cases source="ai"   ├ expand CSV rows per case  │
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

  ADVISORY, OFF UNLESS CONFIGURED:
  ┌──────────────────────────┐  ┌──────────────────────────────────┐
  │ AIProvider: mock|openai  │  │ Jev (TypeSafe System One)       │
  │ |gemini|grok|local       │  │ TYPESAFE_API_KEY                │
  │ page intent · workflow   │  │ login assist · irreversible     │
  │ analysis · AI cases      │  │ guard · locator fallback        │
  │ (GEMINI/XAI/OPENAI keys) │  │ live calls unverified           │
  └──────────────────────────┘  └──────────────────────────────────┘
```

Shared library layer consumed by both runtimes:

| Package | Responsibility |
| --- | --- |
| `@repo/core` | BullMQ queue + worker factories, Redis connections, `StorageProvider` (local/s3), `AppError`, action-safety classification, Pino logging, AES-256-GCM `CredentialCrypto` |
| `@repo/db` | Drizzle client, schema, migrations, seed |
| `@repo/schemas` | Zod contracts shared by web + worker |
| `@repo/browser` | Playwright wrappers: element collection, action/navigation detection, page classification, locator resolution, DOM masking |
| `@repo/ai` | `AIProvider` adapters (`mock`, `openai`, `gemini`, `grok`, `local`) + TypeSafe System One (Jev) client and sanitizer. **Invoked at three advisory points.** |

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
  │    │     ▶ AI interpretPageWithFallback (advisory, heuristic fallback)
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

This path is **fully deterministic** for the matrix itself. With
`AI_PROVIDER` set to a real provider, `createAiCaseGenerator` additionally asks
the model for cases the matrix did not cover (max 10 pages/run, 45s timeout,
grounded on discovered elements, stored as `source = "ai"`); nothing the model
returns can replace a deterministic case.

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
     ▶ expandCases() — a case bound to a CSV dataset runs once per row
       ({{column}} substitution); missing/empty dataset → warn + run once
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
(`TEST_RUN_CONCURRENCY = 1`, serial loop), rerun-failed, and a separate
`test_executions` entity for attempts. CSV expansion runs, but nothing can bind
a case to a dataset (`test_cases.dataset_id` is SQL-only) — see §9.9.

One result row per case (or per dataset row), and a case that throws
mid-execution is recorded as `FAIL` with the error rather than aborting the run.

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
│             │         dataset_id FK (0014)└─< test_run_results  (+ dataset_id/row)
│             ├─< test_runs ────────────────┘   environment_id FK (0013, unpopulated)
       │             └─< sessions (NextAuth-style app sessions)
       └─< accounts / verifications
```

Two modelling notes that matter for the remaining roadmap:

- `test_case_steps` duplicates `test_cases.steps`. The generator writes both;
  the executor reads only the JSONB. The table exists as the relational
  migration path, not as the source of truth.
- CSV binding FKs arrived in migration `0014`: `test_cases.dataset_id` and
  `test_run_results.dataset_id`, both `set null` on delete. The worker writes
  them per row, but nothing in the API/UI can set `test_cases.dataset_id` yet.
- Migrations `0013` tables (`environments`, `coverage_targets` / `coverage_links`
  / `coverage_records`, `finding_groups` / `findings`) are **not touched by
  application code**: the coverage and findings engines are unit-tested but
  never invoked from a run.

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
  and no network. AI and Jev are advisory additions that default to `mock` /
  off, so they never change an outcome the deterministic engine would reach; no
  key means no behavioural risk.
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
