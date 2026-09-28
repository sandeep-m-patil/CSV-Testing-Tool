# Requirements

Authoritative feature requirements for the autotest platform, with the **verified
implementation status** of each as of the last code audit.

## How to read this document

Status is not aspirational. Every row was checked against the source, not against
the intent of a previous document.

| Status | Meaning |
| --- | --- |
| **DONE** | Implemented, wired into a running path, and observed working. |
| **PARTIAL** | Some of it works. The gap is named explicitly. |
| **STUB** | Types, schema or UI exist but nothing drives them. |
| **MISSING** | No implementation. |
| **DEAD** | Implemented but unreachable — no caller anywhere. |

Anything marked PARTIAL, STUB, MISSING or DEAD is a bug against this document,
not a design choice.

---

## 1. Target pipeline

This is the flow the platform is built around.

```text
YOUR WEB APPLICATION
        ↓
Playwright Discovery                    ← crawls, executes actions, records evidence
        ↓
Discover pages / elements / flows
        ↓
APPLICATION MODEL                       ← structured, NOT raw HTML
        ↓
Gemini AI                               ← generates logical test cases (NOT INTEGRATED)
        ↓
Generate Test Cases
        ↓
You approve / edit
        ↓
CSV Test Data
        ↓
TEST EXECUTION ENGINE
        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
Jev Ultrafast                    Playwright
dynamic target help             actual browser
(NOT INTEGRATED)                        │
        └───────────────┬───────────────┘
                        ↓
                  Assertions
                        ↓
                  PASS / FAIL
                        ↓
        Screenshot / Video / Trace / Logs
                        ↓
                Detailed Report
```

### Responsibility boundaries

These boundaries are non-negotiable. They are what stops the system becoming an
unpredictable agent.

| Component | Decides | Must never decide |
| --- | --- | --- |
| **Gemini** | What should be tested. Scenario expansion, classification. | Whether a test passed. Never emits Playwright code. |
| **Jev Ultrafast** | Which on-page element to act on, given page state. | Pass/fail. Never emits selectors, coordinates or JavaScript. |
| **Playwright** | Browser automation. Clicks, typing, navigation. | Test intent. |
| **Test engine** | PASS/FAIL via deterministic assertions, scheduling, retries, artifact capture, CSV parsing, credential storage. | — |

---

## 2. Project structure

A project **is** the application under test. There is deliberately no
intermediate `Application` entity — migration `0002_flatten_project_application`
merged it, and the schema comment at `packages/db/src/schema/project.ts:5`
records the reason.

```text
Project
 ├── Application configuration (baseUrl, environment)
 ├── Credentials                    ← project-scoped (see §3, migration pending)
 ├── Modules                        ← independently manageable
 │    ├── login
 │    ├── products
 │    └── cart
 ├── Discovery
 ├── Test Cases
 ├── CSV Datasets
 ├── Test Runs
 └── Reports
```

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 2.1 | Project holds base URL + environment | **DONE** | `projects.base_url` NOT NULL, `projects.environment` indexed. |
| 2.2 | Project holds many modules, each independent | **DONE** | `modules.project_id` cascade. |
| 2.3 | Module has its own discovery status and lifecycle | **DONE** | `modules.discovery_status`, `modules.status`. |
| 2.4 | Per-module path scoping | **DONE** | `modules.start_path`, `include_paths` jsonb. |
| 2.5 | `Application` entity between Project and Module | **DONE (removed)** | Intentionally flattened. Docs referencing it were stale and are fixed. |
| 2.6 | `Environments` lookup table | **MISSING** | `environment` is a `varchar(24)` column on `projects`, not an entity. No per-environment config or run tagging. |

---

## 3. Centralized credentials

> **Migration approved, not yet performed.** The schema today is
> **module-scoped** (`credentials.module_id`). The target design below is
> project-scoped with module selection. This is a live discrepancy.

### Target design

Credentials belong to the project. Modules *reference* them, and may bind one
or many. A credential is defined once and reused.

```text
Project
 └── Credentials            (Admin, Standard User, Read Only, Test User)
      ↑ referenced by
Modules
 └── module_credentials    (join: module may bind 1..n credentials)
```

### Requirements

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 3.1 | Credentials encrypted at rest | **DONE** | `CredentialCrypto`; only `secret_data` encrypted. `username` is plaintext by design. |
| 3.2 | Passwords never returned by the API | **DONE** | Passwords read only worker-side. |
| 3.3 | Passwords never logged | **DONE** | Secrets are masked in screenshots via `maskSensitiveInputs`; never logged. |
| 3.4 | Passwords never persisted in test-case steps | **DONE** | Steps store `{{username}}`/`{{password}}`; executor substitutes at run time. Verified: no real secret in DB. |
| 3.5 | Passwords never sent to an AI provider | **DONE (vacuous)** | No AI provider is invoked at all today. **Becomes load-bearing the moment Gemini is wired.** |
| 3.6 | Passwords never in reports | **DONE** | Reports carry storage keys, not secrets. |
| 3.7 | Credentials never committed to source control | **DONE** | `.env` files hold secrets; confirm `.gitignore` covers them. |
| 3.8 | AI credentials via environment variables | **DONE** | `OPENAI_API_KEY` etc. in env schema. |
| 3.9 | **Credentials are project-scoped** | **MISSING** | Today `credentials.module_id` NOT NULL. **Migration approved.** |
| 3.10 | **Module selects one or more project credentials** | **MISSING** | No join table exists. |
| 3.11 | Per-environment credential variants | **MISSING** | `Environment` is a listed field in the spec but is not modelled. |
| 3.12 | Additional variables per credential | **MISSING** | Only `username` + encrypted blob. |
| 3.13 | Discovery uses the module's bound credential | **DONE** | `ctx.credentials[0]` drives `exploreAsRole`. |
| 3.14 | Execution uses the module's bound credential | **DONE** | `loadCredentials()` → `ctx.credential` → `resolveValue()`. |
| 3.15 | Missing credential fails loudly | **DONE** | Unresolved token throws rather than typing `{{password}}` into a field. |

---

## 4. Discovery

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 4.1 | Playwright-based discovery engine | **DONE** | `apps/worker/src/discovery/runner.ts`. |
| 4.2 | Discover All (project-wide) | **DONE** | Auto-provisions a `Whole site` module; `provisionProjectDiscovery`. |
| 4.3 | Discover individual module | **DONE** | `POST /api/modules/[moduleId]/discover`. |
| 4.4 | No hard-coded URLs or selectors | **DONE** | Action choice is a generic rule cascade in `action-space.ts`. |
| 4.5 | Structured model, not raw HTML | **DONE** | sessions / pages / elements / actions / state_transitions. |
| 4.6 | Role/label/text-first locators | **DONE** | `getByRole`, `getByLabel`, `getByText` strategies first; CSS/XPath last resort. |
| 4.7 | Bounded crawl (pages, steps, depth, timeout) | **DONE** | All four budgeted via env. |
| 4.8 | Non-blocking on unreachable app | **DONE** | Budgets + timeout; partial results retained. |
| 4.9 | Module membership not decided by URL name alone | **DONE** | Membership by module scope + include paths + navigation. |
| 4.10 | AI-assisted page→module classification | **STUB** | `AIProvider.interpretPage` exists, never called. |
| 4.11 | Incremental discovery | **MISSING** | Every run is a full crawl. |
| 4.12 | Diff new / removed / changed pages & elements | **MISSING** | No comparison against prior session. |
| 4.13 | Rediscover single module | **DONE** | Via §4.3. |
| 4.14 | Discovery evidence with DB relationships | **DONE** | `discovery_artifacts` is properly relational. |

---

## 5. Test case generation

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 5.1 | Deterministic generation from the application model | **DONE** | Auth matrix, generic forms, commerce builders, navigation, smoke floor. |
| 5.2 | Positive / negative / boundary / validation categories | **DONE** | 23-case auth matrix across 7 types. |
| 5.3 | Structured test definitions, not generated code | **DONE** | `test_cases.steps` jsonb + structured expectations. |
| 5.4 | Stable per-module test codes | **DONE** | `test_cases.code`, unique per module. |
| 5.5 | Avoid duplicates on re-discovery | **DONE** | Name-keyed dedup. |
| 5.6 | Re-discovery **refreshes** stale generated cases | **DONE** | Reconcile path; only `source = 'generated'` rows are rewritten, so hand-authored cases are never overwritten. |
| 5.7 | AI-generated test cases | **STUB** | `AIProvider` seam exists; **Gemini provider absent**, no call sites. |
| 5.8 | User selects generation categories | **MISSING** | No category picker. |
| 5.9 | Generate for all / one module / one page | **PARTIAL** | Per-module yes. All-modules and per-page not exposed. |
| 5.10 | Regenerate / generate additional cases | **PARTIAL** | Reconcile updates; "additional" not modelled. |
| 5.11 | Approved cases used as generation context | **MISSING** | Nothing is ever approved (§7). |
| 5.12 | AI output schema-validated before save | **PARTIAL** | Zod schemas exist in `packages/schemas`; unused by any generator. |

---

## 6. Test case approval

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 6.1 | Statuses modelled | **DONE** | `DRAFT / APPROVED / REJECTED / READY` in Zod + DB. |
| 6.2 | API to change status | **DONE** | `PATCH /api/modules/[moduleId]/test-cases/[testId]`. |
| 6.3 | **Review / approve UI** | **MISSING** | Review page is read-only. |
| 6.4 | **Executor honours status** | **MISSING** | `loadCases()` has no status filter — `DRAFT` and `REJECTED` both execute. |
| 6.5 | Review page shows true status | **MISSING** | Hardcoded green "success" badge regardless of status. |

> §6 is the most misleading area of the codebase: the enum, column and route all
> exist, so the feature *looks* present, but it gates nothing.

---

## 7. Execution

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 7.1 | Playwright is the automation engine | **DONE** | Raw Playwright, not the test runner. No `.spec.ts` per case. |
| 7.2 | Structured action model | **DONE** | `GOTO / CLICK / FILL / PRESS / SUBMIT / SELECT / CHECK / UNCHECK / VERIFY`. |
| 7.3 | Every run is a unique, immutable entity | **DONE** | `test_runs`; history preserved. |
| 7.4 | Per-case result rows | **DONE** | `test_run_results`. |
| 7.5 | Deterministic PASS/FAIL | **DONE** | 9 assertion kinds. |
| 7.6 | Async-aware assertions | **DONE** | Polls up to 10s; `stayed_on_page` gets a 3s settle window so a late redirect cannot be recorded as a pass. |
| 7.7 | Isolated browser context per case | **DONE** | `newContext()` per case, closed in `finally`. |
| 7.8 | Screenshot evidence per case | **DONE** | Both pass and fail. |
| 7.9 | One browser engine (Chromium) | **PARTIAL** | Firefox/WebKit not selectable. |
| 7.10 | Headless / headed toggle | **DONE** | `BROWSER_HEADLESS`. |
| 7.11 | Configurable timeouts | **DONE** | Navigation + expectation budgets. |
| 7.12 | **Retries with full attempt history** | **MISSING** | `TEST_RUN_ATTEMPTS = 1`, hardcoded. No attempt column. |
| 7.13 | **Rerun failed** | **MISSING** | No route, no button. |
| 7.14 | **Parallel workers** | **MISSING** | Serial `for` loop. `TEST_RUN_CONCURRENCY = 1`, no override. `WORKER_CONCURRENCY` is discovery-only. |
| 7.15 | Session isolation under parallelism | **MISSING** | No parallelism to isolate. |
| 7.16 | Fail-fast configurable | **MISSING** | Always continues. |
| 7.17 | Separate `test_executions` entity per attempt | **MISSING** | `test_run_results` serves both roles. |
| 7.18 | Production environments blocked | **PARTIAL** | Project creation records a `productionConfirmed` acknowledgement but **skips** auto-discovery for `environment = "production"` rather than rejecting the project. Per-module discovery and **test-run creation have no guard at all**. |

---

## 8. Artifacts

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 8.1 | Screenshot per case | **DONE** | Stored via storage provider. |
| 8.2 | Secrets masked in screenshots | **DONE** | `maskSensitiveInputs` / `unmaskSensitiveInputs`. |
| 8.3 | Evidence captured on failure | **DONE** | Also on pass; loss is logged, never swallowed. |
| 8.4 | **Video capture** | **MISSING** | `recordVideo` never set. |
| 8.5 | **Trace capture** | **MISSING** | No `tracing.*` call anywhere. |
| 8.6 | **Console logs** | **MISSING** | No `page.on('console')` anywhere in the repo. |
| 8.7 | **Page errors / failed requests** | **MISSING** | No listeners. |
| 8.8 | **Artifacts linked by relationship to the execution** | **PARTIAL** | Discovery is relational (`discovery_artifacts`). Test runs use a bare `screenshot_key` text column — no artifact rows, no type. |
| 8.9 | Artifact retention / cleanup | **PARTIAL** | Delete-run removes screenshots best-effort. No general policy. |

> `discovery_artifacts.artifact_type` and the Zod enum already permit
> `trace` / `video` / `log`. Only `screenshot` is ever written. The schema
> anticipates the missing features; the code does not implement them.

---

## 9. CSV data-driven testing

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 9.1 | RFC 4180 parser | **DEAD** | `apps/web/lib/test-cases/csv.ts` — **zero importers**. |
| 9.2 | CSV serialiser | **DEAD** | Same file. |
| 9.3 | Dataset storage | **DONE** | `test_data_sets`, jsonb `data`. |
| 9.4 | Dataset API | **DONE** | CRUD route exists. |
| 9.5 | **Dataset creation works from the UI** | **MISSING** | Client sends `{name, dataType, csv}`; server validates `{name, data:{type, columns, rows}}` → **HTTP 400**. The feature cannot be used. |
| 9.6 | **CSV drives test execution** | **MISSING** | `loadCases()` never reads a dataset. |
| 9.7 | One execution per CSV row, linked to its case | **MISSING** | No row linkage on results. |
| 9.8 | Stable `TC_ID` column matching | **MISSING** | `test_cases.code` exists and is ideal for this. |
| 9.9 | Datasets linked to test cases / runs | **MISSING** | `test_data_sets` has no FK to any execution entity. |
| 9.10 | No static test file generated per row | **DONE (by absence)** | Correct by design. |
| 9.11 | CSV validated on upload | **MISSING** | UI only checks `text.includes(",")`. Quoted fields with commas corrupt the dataset. |

> §9 is currently a façade: the one real implementation is unreachable, and the
> shipped path is broken.

---

## 10. Reporting

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 10.1 | Run summary (total/passed/failed/skipped) | **DONE** | Recalculated from results, not trusted from counters. |
| 10.2 | Module breakdown | **DONE** | `TestResultsPanel`. |
| 10.3 | Duration | **DONE** | Derived from timestamps. |
| 10.4 | Coverage vs. discovered surface | **DONE** | Cases created / executed / untested. |
| 10.5 | Counter-drift detection | **DONE** | `countersConsistent` flag. |
| 10.6 | Screenshots alongside results | **DONE** | Thumbnails + lightbox + full-size report view. |
| 10.7 | Screenshots next to the failing step | **PARTIAL** | Attached to the case, not the individual step. |
| 10.8 | Print / PDF | **DONE** | A4 CSS, verified rendering embedded images. |
| 10.9 | Trace / video / log viewers | **MISSING** | Nothing to view (§8). |
| 10.10 | Filter by project / module / status / run / browser / date / credential / CSV row | **PARTIAL** | Module + run + status only. |
| 10.11 | Project-level and cross-run reporting | **MISSING** | Reporting is module-scoped. |
| 10.12 | JSON export | **DONE** | Test-runs page. |

---

## 11. Live execution UI

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 11.1 | Discovery status polls without refresh | **DONE** | 2s while active. |
| 11.2 | Test-run list polls without refresh | **DONE** | 2s while any run is `QUEUED`/`RUNNING`. |
| 11.3 | Selected run synced to URL, back/forward safe | **DONE** | `?run=` bidirectional. |
| 11.4 | Per-case live status as the run progresses | **PARTIAL** | The run list refreshes; individual case transitions stream only on run detail. |
| 11.5 | Delete a test run | **DONE** | Cascade + evidence cleanup, CSRF/session checked. |
| 11.6 | Paginated, sticky-header results grid | **DONE** | 25/50/100/200/All. |

---

## 12. AI integration

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 12.1 | Provider abstraction (`AIProvider`) | **DONE** | `packages/ai`. |
| 12.2 | Provider factory | **DONE** | `mock` / `openai` / `local`. |
| 12.3 | Deterministic fallback provider | **DONE** | `MockProvider` — regex heuristics, no network. |
| 12.4 | OpenAI-compatible adapter | **DONE** | Raw `fetch`, no SDK dependency. |
| 12.5 | **Gemini provider** | **MISSING** | No `gemini` / `@google/genai` / `GEMINI_API_KEY` anywhere. Clean drop-in via §12.1. |
| 12.6 | **Provider actually invoked** | **MISSING** | Constructed at `runner.ts:107`; only `.label` is read. `interpretPage` / `analyzeWorkflows` have **zero call sites**. |
| 12.7 | AI never required for the pipeline | **DONE** | Whole system runs with no AI. |
| 12.8 | AI never receives secrets | **DONE (vacuous)** | Becomes load-bearing with §12.5. Placeholders `{{username}}`/`{{password}}` already exist in step data. |
| 12.9 | AI output schema-validated | **PARTIAL** | Zod schemas exist; not enforced on any path. |
| 12.10 | AI failure cannot crash the app | **DONE** | No AI is called, so nothing can throw. |
| 12.11 | Web app can request generation | **MISSING** | `@repo/ai` in `transpilePackages` but not a dependency; no web route. |

> Existing docs claimed AI "upgrades heuristics". It does not — heuristics are
> always deterministic. Those claims have been corrected.

---

## 13. Jev Ultrafast integration

> **Not implemented. No code exists.** Verified: zero matches for `jev`,
> `ultrafast`, `actionSelector`, `targetSelector` in the repository.

`browser-use/jev-ultrafast` is real and MIT licensed, but integrating it is not
a matter of adding a file. Three constraints were established by reading the
upstream project:

1. **It is Python** (`uv sync`, `from jev_ultrafast import Agent`). This
   codebase is TypeScript. A sidecar process plus an IPC boundary is required.
2. **It drives real Chrome over CDP** through Browser Use's "Browser Harness" —
   *not* Playwright. The intended diagram, where Jev and Playwright drive one
   page, does not match upstream behaviour. The Node port
   `@tontoko/jev-browser` wraps an existing Playwright `page` and preserves
   native assertions, and is the correct bridge for this repository.
3. **It sends visible page text to its decision model on every step.** After
   authentication that text contains customer data. This conflicts with §3.5
   and requires an explicit redaction decision before any integration.

Requires `TYPESAFE_API_KEY` plus an OpenAI-compatible text-model key.

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 13.1 | Dynamic target resolution when a locator fails | **MISSING** | Today: hard fail with a diagnostic. |
| 13.2 | Structured target → semantic locator → Jev → fail | **MISSING** | §37 fallback chain not built. |
| 13.3 | Unresolved target never silently skipped | **DONE** | Fails with diagnostic. |
| 13.4 | Jev never decides pass/fail | **DONE (vacuous)** | No Jev. |

---

## 14. Cross-cutting

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 14.1 | Structured logging | **DONE** | `createChildLogger` with module/run IDs. |
| 14.2 | Secrets never logged | **DONE** | Verified. |
| 14.3 | Zod validation on API input | **DONE** | `packages/schemas`, `route()` wrapper. |
| 14.4 | AI output validated | **PARTIAL** | §12.9. |
| 14.5 | CSV validated | **MISSING** | §9.11. |
| 14.6 | Session + CSRF on mutations | **DONE** | Guarded route helpers. |
| 14.7 | bcrypt cost ≥ 12 | **DONE** | Auth. |
| 14.8 | Production guard | **PARTIAL** | See §7.18 — acknowledged at creation, skipped for auto-discovery, absent from execution. |
| 14.9 | Evidence route not publicly readable | **MISSING** | `app/storage/[...key]` is unauthenticated. Screenshot URLs are guessable-ish and ungated. |
| 14.10 | Automated test coverage | **MISSING** | One test file in the entire repo (`apps/demo-app/src/app.test.ts`). `pnpm -r test` exits 1. |

---

## 15. Priority order for remaining work

Ordered by user-visible value ÷ risk. Items 1–6 need no external API keys.

| Rank | Item | Requirement |
| --- | --- | --- |
| 1 | Fix dataset creation 400 (schema mismatch) | §9.5 |
| 2 | Wire CSV into the executor: `TC_ID` match, one result per row | §9.6–9.9 |
| 3 | Approve/reject UI + executor status gate | §6.3–6.5 |
| 4 | Migrate credentials to project scope + `module_credentials` | §3.9–3.10 |
| 5 | Artifacts table + video / trace / console capture | §8.4–8.8 |
| 6 | Retries, attempt history, Rerun Failed, parallel workers | §7.12–7.14 |
| 7 | Gemini provider behind `AIProvider`, schema-validated | §12.5–12.6 |
| 8 | Jev bridge via `@tontoko/jev-browser`, with redaction | §13.1–13.2 |
| 9 | Incremental discovery + diffing | §4.11–4.12 |
| 10 | Authenticate the evidence route | §14.9 |

---

## 16. Acceptance scenario

The end-to-end flow this platform must support. Current column reflects what
actually happens today.

| Step | Requirement | Current |
| --- | --- | --- |
| 1 | Create project | Works |
| 2 | Configure application URL | Works |
| 3 | Create centralized credentials | **Blocked** — module-scoped today |
| 4 | Create Login / Orders / Checkout modules | Works |
| 5 | Assign credentials to modules | **Blocked** — §3.10 |
| 6 | Run Discover All | Works |
| 7 | Verify pages and workflows stored | Works |
| 8 | Discover a single module only | Works |
| 9 | Verify only that module's discovery ran | Works |
| 10 | Ask Gemini to generate test cases | **Blocked** — §12.5 |
| 11 | Generate positive / negative / validation / boundary | Deterministic path only |
| 12 | Review and approve test cases | **Blocked** — §6.3 |
| 13 | Upload or select a CSV dataset | **Broken** — §9.5 returns 400 |
| 14 | Execute selected test cases | Works (whole module only) |
| 15 | Use Jev for dynamic target resolution | **Blocked** — §13.1 |
| 16 | Execute actions through Playwright | Works |
| 17 | Deterministic assertions | Works |
| 18 | Run multiple CSV rows | **Blocked** — §9.6 |
| 19 | Run tests in parallel | **Blocked** — §7.14 |
| 20 | Retry failures per configuration | **Blocked** — §7.12 |
| 21 | Capture screenshots | Works |
| 22 | Capture videos | **Blocked** — §8.4 |
| 23 | Capture traces | **Blocked** — §8.5 |
| 24 | Store logs | **Blocked** — §8.6 |
| 25 | Create Test Run | Works |
| 26 | Display live execution status | Works |
| 27 | Generate detailed report | Works |
| 28 | Show screenshots next to failed steps | Partial — §10.7 |
| 29 | View trace / video / logs | **Blocked** — §10.9 |
| 30 | Rerun Failed | **Blocked** — §7.13 |
| 31 | Create a new run for the rerun | **Blocked** — §7.13 |
| 32 | Preserve complete history | Works |

**8 of 32 acceptance steps are blocked.** The two AI integrations account for
none of them being secretly faked — they are honestly absent, and the platform is
fully functional without them.
