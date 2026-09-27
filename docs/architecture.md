# Architecture

![layers](management-UI -> REST API -> Postgres/Redis -> discovery worker -> target app)

The platform is split into three runtimes plus a shared library layer.

## Runtimes

### 1. Management UI + API (`apps/web`, :3000)

Next.js App Router.

- **Pages** (in `app/(app)/`): projects, project detail, applications, module detail, module **config**, module **discovery** (live session stream), module **review** (workflows + test cases).
- **Auth pages**: `/login`, `/signup` (in `app/(auth)/`).
- **API** under `app/api/`: `auth/*`, `projects/*`, `applications/*`, `modules/*` (incl. `discover`, `credentials`, `test-data`, `workflows`, `test-cases`, `report`), `health`, `storage/*`.
- **Conventions** (`lib/api.ts`): every handler wrapped with `route()` → enforces the wide `{ params: Promise<Record<string, string>> }` context (Next 15) and converts errors to `{ data: null, error: { code, message } }`.
- **Guards**: `requireSession()` + `requireModuleAccess()` (CSRF same-origin check on mutations).

### 2. Discovery worker (`apps/worker`)

A long-lived BullMQ consumer (`src/index.ts`) that registers the `discovery` queue worker and delegates to `processDiscoveryJob` (`src/processor.ts`).

Pipeline per job (`src/discovery/runner.ts` -> `runDiscovery`):

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
 │    execute action           actor + resolveLocator()
 │    recordEvidence()          screenshot -> storage (masked)
 │    persist via DiscoveryStore (progressively)
 └─ buildWorkflows()            deterministic, from executed action trace
 └─ generateTestCases()         per workflow, with test data
```

The worker is completely independent from the web API — it only needs `DATABASE_URL`, `REDIS_URL`, storage config, and the browser.

### 3. Demo target application (`apps/demo-app`, :4000)

Planned Playwright/Express-style demo app that discovery attaches to. Referenced by the root `dev` script and seed (`DEMO_APP_URL=http://localhost:4000`). **Not yet implemented** — see roadmap.

## Library layer

| Package | Responsibility |
| --- | --- |
| `@repo/core` | BullMQ queue + worker factory (`createDiscoveryQueue`, `createDiscoveryWorker`, `DISCOVERY_JOB_NAME`), Redis connection, `StorageProvider` (local/s3 via factory), `AppError` + `isAppError`, action safety classification (`classifyAction`, `isLogoutCommand`), Pino logging |
| `@repo/db` | Drizzle client (`getDb`/`closeAll`, neon driver), schema (see below), migrations, seed |
| `@repo/schemas` | Zod input/output schemas shared by web + worker (auth, projects, applications, modules, discovery, credentials, test data, workflows, run results) |
| `@repo/browser` | Playwright wrappers only — element collection, action detection (`detectActions`), navigation detection, page classification (`classifyPage`, `derivePageName`), locator resolution (`resolveLocator`, `LocatorHints`), DOM masking (`maskSensitiveInputs`/`unmaskSensitiveInputs`), page model (`AnalyzedPage`) |
| `@repo/ai` | `AiProvider` adapters: `mock`, `local`, `openai` — submit-kind detection and workflow analysis used to augment deterministic logic |

## Data model (`packages/db/src/schema`)

- `auth.ts` — `users`
- `project.ts` — `projects`, `applications`, `modules`
- `config.ts` — `credentials` (encrypted), `testDataSets`
- `discovery.ts` — `discoverySessions`, `discoveredPages`, `discoveredElements`, `discoveredActions`, `stateTransitions`, `discoveryLogs`
- `workflow.ts` — `workflows`, `workflowSteps`, `testCases`, `testCaseSteps`
- `artifacts.ts` — `discoveryArtifacts` (evidence keys + URLs)

## Data flow (discovery session)

```
POST /api/modules/:moduleId/discover
  1. auth + module access + CSV same-origin
  2. reject production applications
  3. require REDIS_URL
  4. insert discoverySessions row (status=QUEUED)
  5. enqueue BullMQ job { discoverySessionId, moduleId, ... }
  6. flip module -> DISCOVERING / application -> DISCOVERING

worker pulls job
  7. processDiscoveryJob -> runDiscovery
  8. persist progress continuously (session status, pages, actions, logs)
  9. buildWorkflows -> insertWorkflowAndSteps (DRAFT)
 10. generateTestCases -> insertTestCases
 11. session status -> COMPLETED/FAILED + counts

UI polls down-stream
 12. discovery page streams logs + counts; review page lists workflows/test cases
```

## Storage

- Local driver writes to `STORAGE_LOCAL_DIR` (web + worker share `../data/storage`); served via `app/storage/[...key]` and `app/api/storage/[...key]`.
- S3 driver (aws-sdk v3) supports custom endpoint + **path-style addressing** (required by Neon S3). Storage keys are namespaced `modules/{moduleId}/sessions/{sessionId}/...`.

## Security boundaries

- Secrets live only in app-scoped, git-ignored `.env` files.
- Credential secret material is encrypted at rest and decrypted inside the worker only.
- Screenshots are taken after masking sensitive inputs; logs never carry secret values.
- The API enforces auth (`AUTH_SECRET`), module access, CSRF same-origin, Zod validation, and production-environment blocks.