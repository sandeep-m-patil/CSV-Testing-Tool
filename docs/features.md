# Features

Feature inventory with verified implementation status. For the full requirement
matrix see [`requirements.md`](./requirements.md); for how to use the platform see
[`user-manual.md`](./user-manual.md).

> This file previously listed `Project -> Application -> Module` as the
> hierarchy, described the test execution engine and demo app as "not yet built",
> and claimed AI augmented discovery. All three were wrong and have been
> corrected below.

---

## Platform

### Authentication
- Sign up / login / logout via session cookies, no external provider.
- `AUTH_SECRET`-signed sessions; `requireSession()` plus module-level access
  guards on every API route; `assertSameOrigin()` on mutations.
- bcrypt password hashing, cost 12.

### Project hierarchy

`Project → Module`. **There is no `Application` entity** — migration
`0002_flatten_project_application` removed it, and the schema comment in
`packages/db/src/schema/project.ts:5` records why. A project *is* the
application under test.

| Entity | Notes |
| --- | --- |
| **Project** | Top-level workspace. `base_url` NOT NULL, `environment` indexed. `environment` is a `varchar(24)` column, **not** a lookup table. |
| **Module** | A browsable area of the app. Tracks `discovery_status` and `status`. Owns `start_path` + `include_paths` scope, its own credentials, datasets, test cases and runs. |

Creating a project auto-provisions a `Whole site` module and queues discovery —
except for `environment = "production"`, where auto-discovery is skipped (the
project is still created, and a `productionConfirmed` acknowledgement is
recorded).

Pages: `/app/projects`, `/app/projects/[projectId]`.

### Module configuration
`/app/modules/[moduleId]/config`

- **Credentials** — per-role logins (`role`, `username`, encrypted password).
  AES-256-GCM via `CredentialCrypto`; the API returns a `hasSecret` flag, never
  the secret. **Module-scoped, not project-scoped** — the project-level
  migration is approved but not done (`requirements.md` §3.9).
- **Test data** — CSV templates and key/value constants scoped to the module,
  used to fill forms during discovery. **CSV saves work** (server-side RFC 4180
  parse, header-only rejected with 400). Still broken: `KEY_VALUE` saves fail
  validation (client sends an object, schema expects a string), dataset `DELETE`
  removes **every** dataset in the module (two chained `.where()` calls — drizzle
  replaces rather than ANDs), and no API/UI can bind a dataset to a test case.
- Helpers: `CredentialManager`, `TestDataManager`.

### Discovery control room
`/app/modules/[moduleId]/discovery`

- Start a session: `POST /api/modules/:moduleId/discover` → `QUEUED` session +
  enqueued job. The UI button sends an empty body; there is **no role selector
  in the UI** (the API accepts an optional role).
- Live streaming at a 2s poll: status, current URL/step, discovered counts, logs,
  evidence.
- `GET /api/modules/:moduleId/report` — post-run summary.
- Re-running reconciles: only `source = 'generated'` cases are updated, and both
  `test_cases.steps` and `test_case_steps` are rewritten. Hand-authored cases
  survive.

### Workflow + test-case review
`/app/modules/[moduleId]/review`

- Discovered **workflows** and generated **test cases** with stable per-module
  codes, categories, priorities and structured steps.
- Credential values appear as `{{username}}` / `{{password}}` tokens, formatted
  in the UI as `username from Credentials & Data`; passwords render as
  `••••••••`.
- **Read-only.** Approval is not implemented — see `requirements.md` §6. The
  status badge is hardcoded green, and the executor ignores status entirely.

### Health & storage
- `GET /api/health` — Neon query latency + Redis ping → `ok` / `degraded`.
- `/api/storage/[...key]` (session-guarded) serves evidence.
- `/storage/[...key]` is currently **unauthenticated** — an open issue
  (`requirements.md` §14.9).

---

## Discovery (worker)

- **Autonomous exploration** — real Playwright Chromium, login per credential,
  form filling with module test data, submit detection.
- **Safe action space** — candidates indexed and deduped; scoring prefers
  navigation and create flows and excludes `delete` / `logout` / destructive and
  `dangerous` / `blocked` patterns.
- **Hard scope guard** — navigation outside the module is skipped, not recorded.
  Redirects to login are excepted.
- **Deterministic core, optional AI enrichment.** All heuristics run
  unconditionally, but the provider is now **invoked** (advisory, off at the
  default `AI_PROVIDER=mock`): `interpretPageWithFallback` per page (15s
  timeout, heuristic fallback) persists `ai_page_type/ai_purpose/ai_source`;
  `enrichWithAiAnalysis` logs workflow analysis without applying it; and
  `createAiCaseGenerator` may add `source = "ai"` cases beyond the deterministic
  matrix. Nothing the model says ever becomes a locator or a PASS/FAIL opinion.
- **Jev login assist** — with `TYPESAFE_API_KEY`, Jev recognises and completes
  unfamiliar login forms and guards irreversible actions (see `requirements.md`
  §13).
- **Write-ahead persistence** — every page/action/log is durable immediately, so
  the UI can stream live and a worker crash does not lose the session.
- **Budget enforcement** — max pages, steps, actions/page, depth, timeout, sleep,
  all env-tuned.
- **Evidence capture** — masked screenshots per executed action, stored under
  `modules/{moduleId}/sessions/{sessionId}/`.
- **Workflow derivation** — one form workflow per submitted page, one navigation
  workflow per reachable non-login page; steps reference recorded locator hints.
- **Test-case generation** — per workflow: a 23-case auth matrix across 5
  categories for login forms, a 5-case generic baseline otherwise, plus commerce
  builders for product / cart / checkout.

---

## Test execution (worker)

- **Playwright directly**, not the test runner — no `.spec.ts` per case.
- **Structured actions** — `GOTO` / `CLICK` / `FILL` / `PRESS` / `SUBMIT` /
  `SELECT` / `CHECK` / `UNCHECK` / `VERIFY`.
- **Fresh browser context per case**, closed in `finally`, so state never leaks
  between cases.
- **Deterministic assertions** — 9 expectation kinds: `navigated_away`,
  `stayed_on_page` (3s settle), `error_message_present`, `app_responsive`,
  `input_attribute`, `any_of`.
- **Async-aware** — positive expectations poll up to 10s, so a slow render is
  not a false failure and a late redirect is not a false pass.
- **Credential substitution at run time** — decrypted in the worker, resolved
  immediately before `FILL`/`PRESS`, masked from screenshots. An unresolved token
  throws rather than being typed into a field.
- **Resilient** — a case that throws is recorded `FAIL` with its error; the run
  continues.
- **Data-driven** — a case bound to a CSV dataset runs once per row:
  `{{column}}` substitution, `dataset_id` / `dataset_row` on each result, per-row
  screenshot keys (`-row-N`), and a `row N` badge in the grid + report. Binding a
  case to a dataset is **SQL-only today** (no API field, no UI); a missing or
  empty dataset logs a warning and the case runs once unchanged.
- **Not implemented** — retries (`TEST_RUN_ATTEMPTS = 1`, hardcoded), parallel
  workers (`TEST_RUN_CONCURRENCY = 1`, serial), rerun-failed, per-case
  selection, a separate `test_executions` entity, and any environment guard.

---

## Reporting

- Run totals, per-module breakdown, duration, coverage vs. discovered surface.
- **Counter-drift detection** — totals are recalculated from result rows and a
  mismatch is flagged rather than trusted.
- Screenshots inline in the results grid, thumbnails + lightbox, full-size in the
  report.
- **Print / Save-as-PDF** — A4 CSS, verified to render embedded images.
- JSON export of test-run data, plus multi-format export
  `GET /api/modules/[id]/report/export?format=json|html|csv|junit` (up to 50
  runs; CSV/JUnit flatten to one row per test case). The export API is currently
  **UI-less** — no page links to it; the report's "Download JSON" button
  serialises the open run client-side instead.
- Live status polling at 2s, `?run=<id>` URL sync, back/forward safe.
- Delete a test run: cascade + evidence cleanup, session/CSRF checked.
- Sticky-header results grid, 25/50/100/200/All.
- **Not implemented** — trace/video/log viewers (nothing captures them),
  project-level and cross-run reporting, filtering beyond module + run + status,
  screenshots attached to the individual failing step rather than the case.

---

## Not built

Ordered by priority in `requirements.md` §15.

1. **Dataset binding + save/delete fixes** — no API/UI sets `test_cases.dataset_id`
   (SQL-only), `KEY_VALUE` saves fail validation, and dataset `DELETE` removes
   every dataset in the module.
2. **Approve/reject UI + executor status gate.**
3. **Project-scoped credentials** + `module_credentials` join table.
4. **Artifacts table + video / trace / console capture.**
5. **Retries, attempt history, Rerun Failed, parallel workers.**
6. **Wire the coverage + findings engines** into the run processor (engine and
   grouping are unit-tested, never called; `environments` is likewise unread).
7. **Surfaces in the UI** — the AI application-model endpoint and the report
   export API exist but have no buttons.
8. **Incremental discovery** and change diffing.
9. **Authenticate `/storage/[...key]`.**
10. **Root test script** — `pnpm -r test` still exits 1 because `@repo/db`
    declares `vitest run` with zero test files (the other 172 tests all pass).

### Environment-dependent, not on the critical path

- S3 evidence verification, once a Neon S3 bucket exists.
- Live verification of the AI/Jev providers: Gemini (`GEMINI_API_KEY`), Grok
  (`XAI_API_KEY`) and Jev (`TYPESAFE_API_KEY`) are wired and unit-tested, but no
  live call has been made from this environment.
