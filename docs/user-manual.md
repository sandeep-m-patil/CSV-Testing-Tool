# User Manual

How to use the platform, end to end.

> **Read this first.** The platform does exactly what the pages below describe,
> and nothing more. Sections marked ⚠️ describe features that are **planned or
> broken**; they are called out so you don't lose time on them. For the full
> status matrix see [`requirements.md`](./requirements.md).

- [1. What the platform does](#1-what-the-platform-does)
- [2. Setup](#2-setup)
- [3. Create a project](#3-create-a-project)
- [4. Modules](#4-modules)
- [5. Credentials and test data](#5-credentials-and-test-data)
- [6. Discovery](#6-discovery)
- [7. Review workflows and test cases](#7-review-workflows-and-test-cases)
- [8. Run tests](#8-run-tests)
- [9. Reports](#9-reports)
- [10. CSV test data](#10-csv-test-data)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Known limitations](#12-known-limitations)

---

## 1. What the platform does

You point it at a web application. It drives a real Chromium browser to explore
the app, records what it finds as a structured model, generates test cases from
that model, and later runs those cases and reports honestly on what passed.

```text
Project (your app + its URL)
  └─ Module (a part of the app, e.g. "login")
       └─ Discovery  →  pages, forms, elements, actions, transitions
            └─ Workflows + test cases
                 └─ Test run  →  PASS / FAIL / SKIP + screenshots + report
```

Two things to understand before you start:

**A project *is* your application.** There is no separate "Application" layer.
One project = one base URL = one environment.

**Nothing is invented.** Test cases are derived from controls discovery actually
saw on a real page. If a field was not found, no test case is generated for it.
Cases that cannot be verified automatically are reported `SKIP`, never `PASS` —
a suite that reports 100% when it only really checked 60% is worse than useless.

---

## 2. Setup

Four processes: the web app, the worker, Redis, and (optionally) the bundled
demo app.

```bash
# 1. Install
pnpm install

# 2. Configure — copy and edit these
apps/web/.env
apps/worker/.env
packages/db/.env

# 3. Database
pnpm db:push

# 4. One-time browser download
pnpm --filter @repo/worker exec playwright install chromium

# 5. Start (leave running)
pnpm dev
```

The web app runs on **:3000**. The demo target app runs on **:4000**.

Required environment values:

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | db, web, worker | Neon Postgres connection string |
| `REDIS_URL` | web, worker | BullMQ queue |
| `AUTH_SECRET` | web, worker | Signs session cookies. Must match exactly. |
| `STORAGE_DRIVER` | web, worker | `local` (default) or `s3` |
| `BROWSER_HEADLESS` | worker | `true` by default; set `false` to watch it work |

If `AUTH_SECRET` differs between web and worker, you'll be bounced between login
and the app in a loop.

**The worker is not optional.** Discovery and test execution are queue jobs. If
the worker isn't running, a run sits at `QUEUED` forever.

**No AI keys are needed.** See §12.

---

## 3. Create a project

1. Go to <http://localhost:3000> and create an account (or `/signup`).
2. Open **Projects**.
3. Click **New project** and fill in:

| Field | Example | Notes |
| --- | --- | --- |
| **Name** | `Pharma LIMS` | Your workspace name. |
| **Base URL** | `http://localhost:4000` | **Required.** No trailing slash needed; it is normalised. Must be reachable from the worker. |
| **Environment** | `development` | `development`, `staging`, `test`, `production`. |
| **Description** | *optional* | Shown on the project card. |

4. Submit.

**What happens next, automatically:** a `Whole site` module is created, a
discovery session is queued, and the worker starts crawling. You land on the
project page while it works.

If you chose `production`, an extra confirmation checkbox appears. Note that
autonomous discovery is **skipped** for production projects — the project is
created, but nothing crawls until you start a module's discovery yourself.

---

## 4. Modules

A module is a part of your app you want tested independently — `login`,
`products`, `cart`. Each keeps its own discovery, credentials, test cases and
test runs.

**New projects get a `Whole site` module automatically.** Don't add another one
for the whole app; use it.

Add a module from the project page (**Add module**):

| Field | Example | Notes |
| --- | --- | --- |
| **Name** | `products` | Also used in generated test-case codes, e.g. `PRODUCTS-TC-001`. |
| **Description** | *optional* | |
| **Start path** | `/products` | Where the crawl begins. Auto-prefixed with `/` if you omit it. |
| **Include paths** | `/products, /products/new` | Comma-separated. These are in scope. |

### Scoping — why it matters

Discovery **only** explores paths inside your module's scope. This is a hard
guard: the crawler will not follow a link out of scope, and it skips the page
rather than recording it.

- `startPath: /products` + no include paths → crawls `/products` and anything
  reachable beneath it.
- Set `includePaths` to add extra entry points that aren't links from
  `startPath` (deep pages, gated URLs).

Keep modules narrow. A module covering the entire site will crawl the entire
site and produce a large, noisy model. `Whole site` already exists for that.

The module overview page shows its current scope as chips, labelled
`no path set — whole site` when the module is unscoped.

---

## 5. Credentials and test data

Open a module → **Credentials & Test Data** (or `/modules/<id>/config`).

### Credentials

| Field | Example | Notes |
| --- | --- | --- |
| **Role** | `user` | A label for *who* this is. Free text — `user`, `admin`, `Read Only`. |
| **Username / email** | `sandy@gmail.com` | Plaintext, and shown in the UI. |
| **Password** | `••••••••` | Encrypted with AES-256-GCM before it is stored. |

After saving, a card shows the role, the username, and a green **Secret stored**
badge. The password is never returned to the browser, so you cannot read it
back — only replace or delete it.

**How the password is used:** discovery logs in with it to explore the module;
test execution fills it into the form at run time. It is decrypted **only inside
the worker process**, and it is never written to logs, to test-case steps, or to
screenshots. Generated test cases store `{{username}}` and `{{password}}` tokens
and the executor substitutes the real values immediately before typing them.

> **Credible limitation.** Credentials are currently stored **per module**, not
> per project. If three modules all need the same login, you add it three times.
> Project-level credentials with module selection is an approved migration that
> has not been done yet (`requirements.md` §3.9–3.10).

**Add at least one credential before running discovery on a module that requires
login.** Discovery can explore public pages without one, but anything behind a
login will be unreachable.

### Test data

Reusable values for filling forms during discovery.

**Key / value** — one `key=value` per line:

```text
materialName=Bacillus subtilis broth
supplier=BioLabs
expiry=2026-12-31
```

**CSV template** — a header row plus data rows, pasted or uploaded as `.csv`:

```csv
name,supplier,batch
Buffer A,BioLabs,B-1
Buffer B,Acme,B-2
```

> ⚠️ **CSV datasets are currently broken in the UI.** The form sends
> `{ name, dataType, csv }` and the API expects `{ name, data: {...} }`, so
> saving a CSV dataset returns **HTTP 400**. Key/value datasets work. See §10.

---

## 6. Discovery

On the module overview page, click **Discover**.

Discovery launches a real Chromium browser and:

1. **Logs in** if the module has a credential, then continues as an
   authenticated user.
2. **Crawls** from `startPath` within scope, budget-limited.
3. **Records** every page, element, action, and state transition.
4. **Screenshots** each step, with credential fields masked.
5. **Derives workflows** — one per submitted form, one per reachable page.
6. **Generates test cases** from those workflows.

Watch it live at `/modules/<id>/discovery` — the page polls every 2 seconds, so
you see the current URL, step count, discovered counts, logs and evidence
stream in without refreshing.

### Budgets

Discovery is bounded so a broken or infinite app can't crawl forever. Tunable
in `apps/worker/.env`:

| Variable | Default | Effect |
| --- | --- | --- |
| `DISCOVERY_MAX_PAGES` | 20 | Stop after this many pages. |
| `DISCOVERY_MAX_STEPS` | 200 | Stop after this many actions. |
| `DISCOVERY_NAVIGATION_DEPTH` | 3 | Navigation depth limit (1–5). |
| `DISCOVERY_MAX_ACTIONS_PER_PAGE` | 8 | Actions attempted per page (1–40). |
| `DISCOVERY_TIMEOUT_MS` | 30000 | Per-action timeout, not a whole-run cap. |
| `DISCOVERY_PAGE_SLEEP_MS` | 350 | Pause between pages. |
| `WORKER_CONCURRENCY` | 2 | Parallel **discovery** jobs (1–8). |

If discovery stops early, raise these. A large application with a deep sitemap
will legitimately hit the defaults.

### Safety

Destructive actions are excluded by name and pattern: `delete`, `logout`,
`remove`, and anything matching `dangerous` or `blocked` is never clicked. This
is a conservative default, not a guarantee — do not point discovery at a
production system.

### Re-running

Discovery is **idempotent and reconciling**, not duplicating. On a re-run,
generated test cases are matched by name and **updated in place**; manually
authored cases are never touched. That means you can safely re-discover after
every deploy to catch changes.

---

## 7. Review workflows and test cases

`/modules/<id>/review` shows what was found:

- **Workflows** — discovered paths through the app, as `DRAFT`.
- **Test cases** — generated, with a stable code, category, priority and
  step-by-step actions.

For a login form you get a **23-case matrix** across five categories —
valid credentials, invalid password, unregistered account, malformed input,
boundaries and validation. Other pages get a smaller generic baseline.

Each case's steps show credential values as tokens like
`username from Credentials & Data` — the real username and password are
substituted at run time, never stored in the case.

> ⚠️ **This page is read-only, and approval does not exist.** Test cases have a
> status (`DRAFT` / `APPROVED` / `REJECTED` / `READY`) and an API to change it,
> but no UI writes that status, and the badge is hardcoded green regardless of
> the real value. Worse, the executor loads **every** case for the module
> without filtering on status — so `DRAFT` and `REJECTED` cases both run. Do not
> rely on approval to gate anything yet. See `requirements.md` §6.

---

## 8. Run tests

Open `/modules/<id>/test-runs` and click **Run tests**.

What happens:

1. A `test_runs` row is created as `QUEUED` and pushed to the BullMQ
   `test-run` queue.
2. The worker picks it up, flips it to `RUNNING`, and launches Chromium once.
3. For **each test case**, in a **fresh isolated browser context**:
   - perform the actions (`GOTO` / `FILL` / `PRESS` / `CLICK` / `SUBMIT`),
   - substitute `{{username}}` / `{{password}}` from the module credential,
   - evaluate the assertion, polling for up to 10 seconds,
   - screenshot the result, secrets masked,
   - record `PASS` / `FAIL` / `SKIP` with duration and any error.
4. The run finishes as `COMPLETED` with totals.

A case that throws mid-execution is recorded as `FAIL` with its error. It does
not abort the rest of the run.

The page polls every 2 seconds while a run is active, and the selected run is
kept in the URL (`?run=<id>`), so browser back/forward and refresh all work.

**Screenshots are captured on pass as well as fail.** The grid is paginated
(25 / 50 / 100 / 200 / All) with a sticky header.

> ⚠️ You cannot select which cases to run — the button runs the whole module.
> There are also **no retries**, **no rerun-failed**, and **no parallelism**
> (cases run serially, one browser at a time). A 200-case module takes a while
> and a transient network blip is recorded as a real failure. See
> `requirements.md` §7.

---

## 9. Reports

Two reports, both printable.

**Module report** — `/modules/<id>/report`: pages, forms, actions, workflows,
candidate tests, transitions, artifacts and roles, plus a screenshot gallery and
the discovery logs.

**Test-run report** — `/modules/<id>/test-runs`: totals, pass rate, per-case
results with screenshots inline, duration, and coverage against the discovered
surface (cases created vs. executed vs. untested).

To get a PDF: open the report, press **Ctrl/Cmd + P**, and choose **Save as
PDF**. A4 print styling is applied and screenshots render as embedded images.

Test-run data is also available as **JSON export** from the test-runs page.

**Counter drift** is surfaced deliberately: the report recalculates totals from
the actual result rows and flags a mismatch with the run's stored counters,
rather than trusting the counters.

---

## 10. CSV test data

> ⚠️ **Not usable today.** Both halves of this feature are incomplete:
>
> - **Saving a CSV dataset from the UI returns HTTP 400** (client sends
>   `{name, dataType, csv}`, server validates `{name, data:{type, columns,
>   rows}}`).
> - **CSV does not drive execution.** `loadCases()` never reads a dataset, so a
>   run produces one result per *case*, not per *row*. There is no `TC_ID`
>   column matching, no per-row execution rows, and `test_data_sets` has no
>   foreign key to any test or run.
>
> The parser and serialiser in `apps/web/lib/test-cases/csv.ts` are real RFC 4180
> code, but **nothing imports them** — the DSL they implement (`GOTO … | FILL … |
> VERIFY …`) is not a live format and should not be used.
>
> This is priority 1 and 2 on the roadmap (`requirements.md` §15). Key/value
> datasets *do* work today for discovery form-filling.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Run stuck at `QUEUED` | Worker not running | Start `pnpm dev`; confirm the worker process is alive. |
| Discovery stuck at `QUEUED` | Same | Same. |
| `discovery_status = FAILED` | App unreachable, or bad base URL | Open the discovery screen and read the logs. Verify the URL from the worker. |
| Discovery finds almost nothing | Module scope too narrow, or login required and no credential | Widen `includePaths`, or add a credential. |
| Discovery stops early | Budget exhausted | Raise the `DISCOVERY_MAX_*` values. |
| All auth cases `SKIP` | No machine-checkable expectation for that case | Expected for whitespace and show/hide cases — by design, not a bug. |
| Every case `FAIL`s on a login | Wrong password, or role lacks access | Re-enter the credential on the config page. |
| Field filled with literal `{{password}}` | Credential missing at run time | Add the credential; the executor throws rather than typing the token. |
| Module page crashes: `Cannot read properties of undefined (reading 'length')` | Known unfixed bug in the project page | Use the module page directly. |
| Screenshots 404 | Storage driver misconfigured | Check `STORAGE_DRIVER` and that `data/storage` is shared between web and worker. |
| `Module not found: Can't resolve '@valkey/valkey-glide'` | BullMQ optional-dep warning on log startup | Cosmetic; ioredis is used and jobs run. |
| Redis connection errors | Redis not running | Start Redis (Docker Compose). |
| AI features seem to do nothing | `AI_PROVIDER` defaults to `mock` | The AI paths are advisory no-ops on the default; set `AI_PROVIDER=gemini|grok|openai|local` plus the matching key. See §12. |

---

## 12. Known limitations

Read this before you plan around the platform.

### Not implemented at all

- **Gemini/Grok/OpenAI/local AI.** Implemented (`AIProvider` + factory,
  `sanitize.ts` redaction) and wired into discovery, workflow analysis and
  extra case suggestions — but **advisory and off by default**
  (`AI_PROVIDER=mock`). Live calls have not been verified against real
  endpoints. Test generation you see is deterministic unless a provider is
  configured; the model never influences PASS/FAIL.
- **Jev Ultrafast.** Wired via TypeSafe System One behind `TYPESAFE_API_KEY`
  (login assist + irreversible-action guard in discovery, locator fallback in
  execution) and untested live. When a test case cannot resolve its target
  through Playwright, the case **fails with a diagnostic** — never silently
  skipped — see §8.
- **Video, trace, and console/network logs.** Only screenshots are captured.
  The schema anticipates the other artifact types; nothing writes them.
- **Approve / reject workflow.** Statuses exist but gate nothing (§7).
- **Retries, rerun-failed, parallel execution.** (§8)
- **Per-case test selection.** Runs execute the whole module.
- **Incremental discovery.** Every run is a full crawl of the module.

### Broken

- **CSV dataset creation** returns 400; **CSV-driven execution** does not exist
  (§10).
- **The project detail page** throws on `.length` of undefined.

### Security notes

- **Evidence URLs are currently unauthenticated.** `/storage/...` serves
  screenshots without a session check. `/api/storage/...` is guarded. If your
  screenshots contain sensitive data, use the authenticated route or restrict
  the local storage directory until this is fixed (`requirements.md` §14.9).
- **The production guard is inconsistent.** Production projects skip
  auto-discovery, but per-module discovery and test-run creation have **no
  environment check at all**. Do not point this at production.

### Intended, by design

- **Deterministic generation, not AI-generated.** The test cases are derived
  from controls discovery actually found. This is why the platform works with
  zero API keys and produces reproducible results — but it also means coverage
  is bounded by what discovery can see. A flow the crawler cannot reach gets no
  test cases.
- **`SKIP` is used honestly.** Cases with no verifiable outcome report `SKIP`.
  A high skip count is a signal, not noise to be hidden.

---

## 13. Glossary

| Term | Meaning |
| --- | --- |
| **Project** | Your application: one base URL, one environment, one credential pool (today, per module). |
| **Module** | An independently testable part of the app, with its own discovery and test runs. |
| **Scope** | The paths a module may explore. Enforced hard during discovery. |
| **Discovery** | Automated exploration that builds the application model. |
| **Application model** | The stored result: pages, elements, actions, state transitions. Not raw HTML. |
| **Workflow** | A discovered path through the app, as numbered human-readable steps. |
| **Test case** | A generated, structured, executable sequence of actions plus an assertion. |
| **Test run** | One immutable execution of a module's test cases. History is preserved. |
| **Expectation / assertion** | The deterministic check that decides `PASS` / `FAIL`. |
| **Artifact / evidence** | A screenshot of a discovery step or test case. |
| **Budget** | The limits that stop discovery running unbounded. |
| **Scope guard** | The hard check that prevents crawling outside a module. |
