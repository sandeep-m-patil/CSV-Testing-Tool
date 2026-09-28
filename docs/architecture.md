# Architecture

> For the stack table, full architecture diagram and end-to-end workflows, see
> [tech-stack.md](./tech-stack.md). This document covers the structural detail.

The platform is split into three runtimes plus a shared library layer.

## Runtimes

### 1. Management UI + API (`apps/web`, :3000)

Next.js App Router.

- **Pages** (in `app/(app)/`): projects, project detail, modules, module detail, module **config**, module **discovery** (live session stream), module **review** (workflows + test cases), module **report**.
- **Auth pages**: `/login`, `/signup` (in `app/(auth)/`).
- **API** under `app/api/`: `auth/*`, `projects/*` (incl. `discover`, `modules`), `modules/*` (incl. `discover`, `discovery`, `credentials`, `test-data`, `workflows`, `test-cases`, `test-runs`, `report`), `test-runs/*`, `health`, `storage/*`.
- **Conventions** (`lib/api.ts`): every handler wrapped with `route()` → enforces the wide `{ params: Promise<Record<string, string>> }` context (Next 15) and converts errors to `{ data: null, error: { code, message } }`.
- **Guards**: `requireSession()` + `requireModuleAccess()` (CSRF same-origin check on mutations).

### 2. Worker (`apps/worker`)

A long-lived BullMQ consumer (`src/index.ts`) that registers **two** workers: the
`discovery` queue → `processDiscoveryJob`, and the `test-run` queue →
`processTestRunJob` (`src/test-execution/processor.ts`).

Pipeline per discovery job (`src/discovery/runner.ts` -> `runDiscovery`):

```
runDiscovery
  ├─ load context (module, credentials, test data, budget limits)
  ├─ launch browser context (headless, isolated, secret-safe)
  ├─ login using an encrypted credential (one per role)
  ├─ per page:
  │    snapshotPage()            @repo/browser  element collection
  │    analyzeCurrentPage()      @repo/browser  page classification/name/heading
  │    buildActionSpace()        action-space.ts (indexed, deduped actions)
  │    decideOneAction()         action-space.ts (scored selection)
  │    execute action            actor + resolveLocator()
  │    recordEvidence()          screenshot -> storage (masked)
  │    persist via DiscoveryStore (progressively)
  ├─ buildWorkflows()            deterministic, from executed action trace
  └─ generateTestCases()         23-case auth matrix / 5-case generic baseline
```

Test-run pipeline (`src/test-execution/processor.ts` -> `executeCase`):

```
processTestRunJob
  ├─ test_runs -> RUNNING
  ├─ load every test case for the module
  ├─ launch chromium once
  ├─ per case, in a fresh browser context:
  │    perform action steps (GOTO / FILL / PRESS / CLICK / SUBMIT)
  │    evaluate the VERIFY expectation (assertions.ts)
  │    mask secrets -> screenshot -> storage
  │    INSERT test_run_results (PASS | FAIL | SKIP, duration, actual, error)
  └─ test_runs -> COMPLETED with totals
```

The worker is completely independent from the web API — it only needs
`DATABASE_URL`, `REDIS_URL`, storage config, and the browser.

### 3. Demo target application (`apps/demo-app`, :4000)

An Express lab-materials management app that discovery attaches to: `/`,
`/login`, `/dashboard`, `/materials`, `/materials/new`, `/materials/:code`,
`/materials/:code/submit|approve|reject`, `/review`, `/approvals`, `/reports`,
`/reports/generate`, `/reports/:id`. It provides an auth form, CRUD forms and
role-gated approval flows for discovery to crawl.


## Library layer

| Package | Responsibility |
| --- | --- |
| `@repo/core` | BullMQ queue + worker factories (`createDiscoveryQueue`, `createTestRunQueue`, `createDiscoveryWorker`, `createTestRunWorker`, job names), Redis connection, `StorageProvider` (local/s3 via factory), `AppError` + `isAppError`, action safety classification (`classifyAction`, `isLogoutCommand`), `CredentialCrypto` (AES-256-GCM), Pino logging |
| `@repo/db` | Drizzle client (`getDb`/`closeAll`, postgres-js driver), schema (see below), migrations, seed |
| `@repo/schemas` | Zod input/output schemas shared by web + worker (auth, projects, modules, discovery, credentials, test data, workflows, test cases) |
| `@repo/browser` | Playwright wrappers only — element collection, action detection (`detectActions`), navigation detection, page classification (`classifyPage`, `derivePageName`), locator resolution (`resolveLocator`, `LocatorHints`), DOM masking (`maskSensitiveInputs`/`unmaskSensitiveInputs`), page model (`AnalyzedPage`) |
| `@repo/ai` | `AiProvider` interface + `mock` / `local` / `openai` adapters. ⚠️ **Never invoked** — the provider is constructed at `runner.ts:107` and only `.label` is read; `interpretPage` / `analyzeWorkflows` have zero call sites, and there is no Gemini implementation. See `tech-stack.md` § AI and agent integration status |

## Data model (`packages/db/src/schema`)

- `auth.ts` — `users`
- `project.ts` — `projects`, `modules`
- `config.ts` — `credentials` (encrypted), `testDataSets`
- `discovery.ts` — `discoverySessions`, `discoveredPages`, `discoveredElements`, `discoveredActions`, `stateTransitions`, `discoveryLogs`
- `workflow.ts` — `workflows`, `workflowSteps`, `testCases`, `testCaseSteps`, `testRuns`, `testRunResults`
- `artifacts.ts` — `discoveryArtifacts` (evidence keys + URLs)

## Data flow (discovery session)

```
POST /api/modules/:moduleId/discover
  1. auth + module access + same-origin CSRF
  2. reject production projects
  3. require REDIS_URL
  4. insert discoverySessions row (status=QUEUED)
  5. enqueue BullMQ job { discoverySessionId, moduleId, projectId, role? }
  6. flip module -> DISCOVERING / ACTIVE

worker pulls job
  7. processDiscoveryJob -> runDiscovery
  8. persist progress continuously (session status, pages, actions, logs)
  9. buildWorkflows -> insertWorkflowAndSteps (DRAFT)
 10. generateTestCases -> insertTestCase
 11. session status -> COMPLETED/FAILED + counts

UI polls down-stream
 12. discovery page streams logs + counts; review page lists workflows/test cases
```

## Data flow (test run)

```
POST /api/modules/:moduleId/test-runs
  1. auth + module access + same-origin CSRF
  2. insert testRuns row (status=QUEUED)
  3. enqueue BullMQ job on the "test-run" queue

worker pulls job
  4. processTestRunJob -> testRuns -> RUNNING
  5. load test cases for the module
  6. per case in a fresh browser context: run steps, evaluate expectation
  7. mask secrets -> screenshot -> modules/{moduleId}/runs/{runId}/{slug}.png
  8. insert testRunResults (PASS | FAIL | SKIP, duration, actual, error, screenshot)
  9. testRuns -> COMPLETED with total/passed/failed/skipped

UI polls down-stream
 10. GET /api/test-runs/:id returns run + results + resolved screenshot URLs
```

## Storage

- Local driver writes to `STORAGE_LOCAL_DIR` (web + worker share `../data/storage`); served via `app/storage/[...key]` and `app/api/storage/[...key]`.
- S3 driver (aws-sdk v3) supports custom endpoint + **path-style addressing** (required by Neon S3). Storage keys are namespaced:
  - discovery evidence — `modules/{moduleId}/sessions/{sessionId}/...`
  - test run evidence — `modules/{moduleId}/runs/{testRunId}/{case-slug}.png`

## Security boundaries

- Secrets live only in app-scoped, git-ignored `.env` files.
- Credential secret material is encrypted at rest and decrypted inside the worker only.
- Screenshots are taken after masking sensitive inputs; logs never carry secret values.
- The API enforces auth (`AUTH_SECRET`), module access, CSRF same-origin, Zod validation, and production-environment blocks.