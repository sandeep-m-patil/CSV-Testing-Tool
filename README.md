# Autotest SaaS — Autonomous Web Application Testing Platform

Run a real browser against an app, autonomously discover its pages/forms/actions, and get human-readable **test workflows** and **executable test cases** — managed from a web UI. Postgres runs on **Neon**; Redis runs in **Docker**; everything else is pnpm-workspace TypeScript.

> Detailed docs: [tech-stack](docs/tech-stack.md) · [architecture](docs/architecture.md) · [features](docs/features.md) · [example flows](docs/example-flows.md) · [configuration](docs/configuration.md)

---

## Implemented functionality

### 1. Authentication & sessions
- Sign up / sign in / sign out — cookie-based sessions signed with `AUTH_SECRET`.
- `GET /api/auth/me` (current session), `requireSession()` guards on every protected route.
- Login page: `/login`, sign-up page: `/signup`.

### 2. Project → Application → Module hierarchy
- **Projects** — create, list, rename, delete, view detail.
- **Applications** — the system under test, with an `environment` (`development | staging | test | production`). **Production apps are hard-blocked from discovery.**
- **Modules** — browsable areas of the app (e.g. *Materials*, *Lab Books*), with live `discoveryStatus` and `status` tracking.

Pages: `/app/projects`, `/app/projects/[projectId]`, `/app/projects/[projectId]/applications/new`, `/app/projects/[projectId]/applications/[applicationId]`.

### 3. Module configuration
- **Credentials** (per role) — username/password per role (e.g. `qa_analyst`). Secrets are **AES-256-GCM encrypted** at rest; the web UI only ever receives a `hasSecret` flag.
- **Test data** — key/value constants and CSV templates scoped to the module; used to fill discovery forms and as inputs to generated test cases.
- UI: `/app/modules/[moduleId]/config` (`CredentialManager`, `TestDataManager` with query invalidation + toasts).

### 4. Autonomous discovery control room
- Start a session: `POST /api/modules/:moduleId/discover` (optionally choose a login role) → inserts a `QUEUED` discovery session and enqueues a BullMQ job.
- Guard rails: same-origin CSRF check, module access, **production block**, Redis availability check (`REDIS_UNCONFIGURED` 503 if missing).
- Live session page `/app/modules/[moduleId]/discovery` streams status, current URL/step, page/action/workflow counters, structured logs, and evidence.

**What the worker does per session** (`apps/worker`, Playwright + Chromium):
- launches an isolated, secret-safe browser context and logs in with the chosen role;
- walks the app up to a configurable budget (pages, steps, actions/page, nav depth, timeouts);
- per page: collects elements → classifies the page type → builds an indexed, deduped **action space** → picks the next *safe* action (dangerous/blocked and logout/destructive actions excluded) → executes it → records the transition;
- fills forms using the module's test data and submits;
- persists every page/action/transition/log **immediately** (write-ahead) so the UI streams progress in real time;
- captures a **secrets-masked screenshot** per executed action.

### 5. Workflow generation
From the executed action trace (`apps/worker/src/workflows/builder.ts`):
- a **form workflow** per page where something was filled + submitted (login precondition, `GOTO → FILL* → SUBMIT → VERIFY` steps, values resolved from test data);
- a **navigation workflow** per other reachable page (`GOTO + VERIFY heading`).
- Workflows persist as `source: discovered`, `status: DRAFT`, with a confidence score.

### 6. Test case generation
`apps/worker/src/test-generation/generator.ts` expands each workflow into step-by-step **test cases** with ordered steps, expected results, and references to module test data.

### 7. Review & reporting
- `/app/modules/[moduleId]/review` — browse discovered workflows and generated test cases; approve/edit via APIs (`workflows/*`, `test-cases/*`).
- `GET /api/modules/[moduleId]/report` — per-module discovery summary.

### 8. Health & evidence storage
- `GET /api/health` — Neon query latency + Redis ping → `ok` / `degraded`.
- **Local storage** driver (default) shares `../data/storage` between web + worker; evidence served via `/storage/[...key]` and `/api/storage/[...key]`.
- **S3 driver** (aws-sdk v3, custom endpoint + `forcePathStyle` for Neon S3) — stored keys: `modules/{moduleId}/sessions/{sessionId}/...`.

### 9. Optional AI augmentation
Adapter pattern (`mock` | `openai` | `local`) for submit-detection and workflow analysis. Everything is **deterministic and fully functional with `AI_PROVIDER=mock`** — AI only upgrades heuristics.

---

## REST API map

```
POST   /api/auth/signup · POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me
GET|POST      /api/projects                    GET|PATCH|DELETE /api/projects/[projectId]
                                              GET /api/projects/[projectId]/detail
GET|POST      /api/applications                GET|PATCH|DELETE /api/applications/[applicationId]
                                              POST /api/applications/[applicationId]/modules
GET|PATCH|DELETE /api/modules/[moduleId]
POST  /api/modules/[moduleId]/discover         GET /api/modules/[moduleId]/discovery
GET|POST /api/modules/[moduleId]/credentials   GET|PATCH|DELETE /api/modules/[moduleId]/credentials/[id]
GET|POST /api/modules/[moduleId]/test-data
GET|POST /api/modules/[moduleId]/workflows     GET|PATCH|DELETE /api/modules/[moduleId]/workflows/[id]
GET|POST /api/modules/[moduleId]/test-cases    GET|PATCH|DELETE /api/modules/[moduleId]/test-cases/[id]
GET  /api/modules/[moduleId]/report
GET  /api/health                               GET|PUT /api/storage/[...key] · GET /storage/[...key]
```

All responses use the envelope `{ data, meta, error }`; validation via Zod; errors via `AppError`.

---

## Quickstart

```bash
pnpm install
# configure apps/web/.env, apps/worker/.env, packages/db/.env (see docs/configuration.md)
pnpm db:migrate && pnpm db:seed          # against your Neon, unpooled URL
docker compose -f docker/docker-compose.yml up -d redis   # Redis only
pnpm --filter @repo/worker exec playwright install chromium
pnpm dev:web      # http://localhost:3000  — login demo@autotest.dev / demo1234
pnpm dev:worker   # discovery consumer
```

| Command | Purpose |
| --- | --- |
| `pnpm dev:web` / `pnpm dev:worker` | Web app (:3000) / worker |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Drizzle schema / DDL / demo data |
| `pnpm typecheck` / `lint` / `test` | `tsc --noEmit` · ESLint · Vitest |
| `pnpm build` | Workspace build |

---

## Repository layout

```
apps/web/        Next.js 15 management UI + API (:3000)
apps/worker/     BullMQ consumer: discovery → workflows → test cases
apps/demo-app/   Demo target (:4000) — roadmap
packages/core/   Queue, storage, errors, safety, logging
packages/db/     Drizzle schema, migrations, seed
packages/schemas/ Shared Zod contracts
packages/browser/ Playwright: collection, detection, analysis, redaction
packages/ai/     mock / local / OpenAI adapters
```

## Security model
- Secret-bearing env vars are git-ignored and app-scoped.
- Credentials encrypted (AES-256-GCM); decrypted only inside the worker.
- Screenshots are taken after DOM masking of sensitive inputs.
- Production applications are blocked from autonomous discovery; destructive/logout actions are never executed.