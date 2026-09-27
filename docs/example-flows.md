# Example End-to-End Flow

This walkthrough shows the canonical "autonomous testing" story: seed a project, configure a module, run discovery, and get workflows + test cases out the other side.

## 1. Seed the database

```bash
pnpm db:seed
```

Creates:

- **User** — `demo@autotest.dev` / `demo1234`.
- **Project** — e.g. "Pharma QA 2026".
- **Application** — "Pharma LIMS", environment `staging`, target `http://localhost:4000`.
- **Modules** (5) — e.g. **Materials**, **Lab Books**, **Review**.
- **Credentials** (2) + **test data sets** (2) pre-attached to modules.

> Requires a demo target running at `http://localhost:4000` for a full discovery run.

## 2. Log in and open a module

1. `pnpm dev:web` → http://localhost:3000
2. Sign in as `demo@autotest.dev` / `demo1234`.
3. Open **Projects → Pharma QA 2026 → Pharma LIMS → Materials**.

The module page shows status and a **Discover** entry point.

## 3. Configure the module

Open the **Config** tab:

- **Credentials**: add a role (e.g. `qa_analyst`) with username/password. The secret is encrypted with AES-256-GCM and stored via `POST /api/modules/:moduleId/credentials`; the UI only ever sees `hasSecret: true`.
- **Test data**: add a key/value dataset, e.g. `lot_number → LOT-901`, `quantity → 12`, plus a CSV template for multi-row scenarios.

## 4. Run discovery

Click **Discover** (optionally choose the credential role to log in with).

`POST /api/modules/:moduleId/discover`:

1. `requireSession()` + `requireModuleAccess()` + CSRF check.
2. Rejects the request if the application `environment === "production"` (`PRODUCTION_BLOCKED`).
3. Requires `REDIS_URL`; otherwise `REDIS_UNCONFIGURED` (503) with a hint to start Redis.
4. Inserts a `discoverySessions` row with status `QUEUED`.
5. Enqueues a BullMQ job `{ discoverySessionId, moduleId, applicationId, projectId, role }`.
6. Flips module + application to `DISCOVERING`.
7. Returns `201` with the session id — open the Discovery tab to watch it stream.

## 5. The worker explores

`apps/worker` consumes the job (`src/index.ts` → `processDiscoveryJob` → `runDiscovery`):

1. Loads context: module, credential (decrypted in-memory only), test data, budget from env.
2. Launches a headless Chromium context (isolated, secret-safe).
3. Logs in with the selected role.
4. Per page:
   - `snapshotPage()` collects form inputs, buttons, links, tables, dialogs.
   - `analyzeCurrentPage()` classifies the page (`login` / `dashboard` / `list` / `form` / `detail` / …) and derives a display name.
   - `buildActionSpace()` indexes + dedupes candidate actions; blocked/dangerous actions (logout, destructive) are excluded.
   - `decideOneAction()` scores and picks the next safe action (navigate → fill → submit).
   - Executes it, detects the transition (`stateTransitions`), and captures a **masked screenshot**.
   - `DiscoveryStore` persists pages, elements, actions, transitions, and logs immediately.

Every step is durable before the next one runs, so the web Discovery tab streams progress in near real time.

## 6. Results are built

In `src/workflows/builder.ts`:

- **Form workflow** per page where we filled + submitted (login precondition, GOTO/FILL/…/SUBMIT/VERIFY steps, resolved values from test data).
- **Navigation workflow** per other reachable page (GOTO + VERIFY heading).

In `src/test-generation/generator.ts`:

- One or more **test cases** per workflow, with step order, expected results, and references to module test data.

Workflows are inserted as `source: discovered`, `status: DRAFT`, with a confidence score; the session is marked `COMPLETED` with page/action/workflow counts.

## 7. Review in the UI

Open the **Review** tab:

- Discovered workflows with human-readable steps and preconditions.
- Generated test cases with per-step actions and expected results.
- `GET /api/modules/:moduleId/report` summaries everything for the module.

Evidence screenshots are served back through the app (`/storage/...`) from the shared local storage dir (or S3 once configured).

## Concepts in one line

| Thing | What it is |
| --- | --- |
| Project | Workspace container |
| Application | Deployed system under test (has an environment) |
| Module | Browsable area targeted by discovery |
| Discovery session | One automated exploration run (QUEUED → RUNNING → COMPLETED/FAILED) |
| Workflow | Human-readable scenario (GOTO/FILL/SUBMIT/VERIFY) |
| Test case | Executable expansion of a workflow with data + expected results |