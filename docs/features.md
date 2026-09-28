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
- **Test data** — key/value constants and CSV templates scoped to the module,
  used to fill forms during discovery. CSV dataset creation is **broken from the
  UI** (HTTP 400 schema mismatch).
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
- **Deterministic.** All heuristics are unconditional. The `AIProvider` is
  constructed at `runner.ts:107` and only `.label` is read; `interpretPage` and
  `analyzeWorkflows` have **zero call sites**.
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
- JSON export of test-run data.
- Live status polling at 2s, `?run=<id>` URL sync, back/forward safe.
- Delete a test run: cascade + evidence cleanup, session/CSRF checked.
- Sticky-header results grid, 25/50/100/200/All.
- **Not implemented** — trace/video/log viewers (nothing captures them),
  project-level and cross-run reporting, filtering beyond module + run + status,
  screenshots attached to the individual failing step rather than the case.

---

## Not built

Ordered by priority in `requirements.md` §15.

1. **Fix CSV dataset creation** (HTTP 400 schema mismatch).
2. **Wire CSV into the executor** — `TC_ID` matching, one execution + result per
   row. The RFC 4180 parser in `apps/web/lib/test-cases/csv.ts` exists but has
   **zero importers**; the DSL it implements is not a live format.
3. **Approve/reject UI + executor status gate.**
4. **Project-scoped credentials** + `module_credentials` join table.
5. **Artifacts table + video / trace / console capture.**
6. **Retries, attempt history, Rerun Failed, parallel workers.**
7. **Gemini provider** behind the existing `AIProvider` seam, with output
   validation and redaction.
8. **Jev bridge** via `@tontoko/jev-browser`, with page-text redaction.
9. **Incremental discovery** and change diffing.
10. **Authenticate `/storage/[...key]`.**
11. **Fix the project detail page** `.length` crash.
12. **Automated tests** — one test file exists in the repo; `pnpm -r test` exits 1.

### Environment-dependent, not on the critical path

- S3 evidence verification, once a Neon S3 bucket exists.
- Gemini and Jev both need paid API keys (`GEMINI_API_KEY`;
  `TYPESAFE_API_KEY` plus a text-model key).
