# Features

## Platform (Phase 1) — management UI

### Authentication
- Sign up / login / logout via session cookies (no external provider).
- `AUTH_SECRET`-signed sessions; `requireSession()` + module-level access guards on every API route.

### Project hierarchy
`Project -> Application -> Module`

| Entity | Notes |
| --- | --- |
| **Project** | Top-level workspace (e.g. "Pharma QA 2026"). |
| **Application** | Deployed system under test with an `environment` (`development` / `staging` / `test` / `production`). **Production applications are blocked from discovery.** Seed: "Pharma LIMS". |
| **Module** | A browsable area of the app (e.g. "Materials", "Lab Books", "Review"). 5 seeded modules. Tracks `discoveryStatus` and `status`. |

Pages: `/app/projects`, `/app/projects/[projectId]`, `/app/projects/[projectId]/applications/new`, `/app/projects/[projectId]/applications/[applicationId]`.

### Module configuration
`/app/modules/[moduleId]/config`

- **Credentials** — per-role logins (e.g. QA analyst, admin). Secrets AES-256-GCM encrypted, stored with `hasSecret` flag only; never returned to the browser.
- **Test data** — reusable datasets: key/value constants and CSV templates, scoped to the module. Used to fill forms during discovery and as inputs in generated test cases.
- Helpers: `CredentialManager`, `TestDataManager` (React Query mutations + toasts).

### Discovery control room
`/app/modules/[moduleId]/discovery`

- Start a session: `POST /api/modules/:moduleId/discover` (role optional) → creates a `QUEUED` session and enqueues the job.
- Live streaming: session status, current URL/step, pages/actions/workflows discovered, logs, evidence artifacts.
- `GET /api/modules/[moduleId]/report` — summary report after completion.

### Workflow + test-case review
`/app/modules/[moduleId]/review`

- Discovered **workflows** (DRAFT status, human-readable steps, preconditions, confidence) and generated **test cases** with per-step actions and expected results.
- APIs: `workflows/`, `workflows/[workflowId]`, `test-cases/`, `test-cases/[testId]`.

### Health & storage
- `GET /api/health` — checks Neon availability (query latency) + Redis ping; returns `ok` / `degraded`.
- `/storage/[...key]` and `/api/storage/[...key]` serve captured evidence from the configured storage driver.

## Discovery (Phase 2) — worker

- **Autonomous exploration**: real Playwright browser, login per credential role, form filling with module test data, submit + detect page transitions.
- **Safe action space**: candidate actions are indexed + deduped; scored selection prefers navigation/create flows and avoids `delete`/`logout`/destructive and `dangerous`/`blocked` patterns.
- **Deterministic + AI-augmented**: everything works with `AI_PROVIDER=mock`; OpenAI/local models can refine submit detection and workflow analysis.
- **Progressive write-ahead persistence**: every page/action/log is durable immediately, so the UI streams it live.
- **Budget enforcement**: max pages, steps, actions/page, navigation depth, timeout, per-page sleep — all env-tuned.
- **Evidence capture**: masked screenshots per executed action, stored under `modules/{moduleId}/sessions/{sessionId}/...`.
- **Workflow derivation**: a form/submit workflow per filled-and-submitted page plus a navigation workflow per reachable non-login page; steps reference locator hints recorded during discovery.
- **Test case generation**: per workflow, expands to step-by-step test cases reusing module test data.

## Roadmap (not yet built)

- **Demo target app** (`apps/demo-app`, port 4000) that the seed's "Pharma LIMS" points at.
- **Test case execution engine** (running generated cases against the target + pass/fail reporting).
- **Concurrency/scheduling UX** (re-run history, scheduling, retention policies).
- **S3 evidence verification** once a Neon S3 bucket is created.
- Higher test coverage (Vitest suites per package) toward the 80% line budget.