# Platform Plan

Adapts the full QA-autopilot product specification to **this** repository, which is
already a working pnpm monorepo (`autotest-saas`). The specification is treated as the
target; the existing architecture is treated as the constraint.

Read with: `docs/requirements.md` (current agreed behaviour), `docs/tech-stack.md`.

---

## 1. Direct answers to the explicit questions

### Keep Neon? Yes — no database change.

Neon Postgres (`ep-empty-thunder-azbc1rkp`, `ap-southeast-1`) stays as the single source
of truth for **all structured data**: projects, modules, pages, elements, actions,
navigation edges, workflows, transitions, test cases, steps, test data, discovery runs,
test runs, results, findings, coverage records, users, and credentials.

The spec's "PostgreSQL/Neon" and "do not introduce Neo4j" are both already satisfied. No
engine swap, no Prisma, no new datastore.

### Store images/screenshots in Neon? No — use object storage.

This is the one place where "use Neon for everything" is the wrong answer.

| Data | Store in | Why |
| --- | --- | --- |
| Credentials (AES-256-GCM ciphertext), business data, model rows | **Neon** | Small, relational, queried, needs transactions and FKs |
| Screenshots, Playwright traces, videos, DOM snapshots, console/network logs | **Object storage** (MinIO local, S3/R2 prod) | Large binaries; they must not bloat the relational store, its WAL, or its backups |
| Evidence **metadata** (object key, type, label, URL, timestamp, duration, status) | **Neon** | Relational, indexed, joined to test results |

Neon stores only the *pointer* to each artifact. This separation already exists in the
repo: `packages/core/src/storage` has `local.ts`, `s3.ts`, `factory.ts`, a
`StorageProvider` interface, and `apps/web/app/api/storage/[...key]` serves objects. The
missing piece is only MinIO in `docker/docker-compose.yml` and S3 env keys in `.env.example`.

### Pooling

Keep both URLs as they are today: pooled (`-pooler`) for web + worker, direct for
`packages/db` migrations. Neon serverless driver or `pg` both acceptable; do not switch
wholesale mid-build.

---

## 2. Decisions on the spec's tech choices

| Spec asks | Decision | Rationale |
| --- | --- | --- |
| Fastify API | **Keep Next.js route handlers** for MVP | The API already exists as 24 route handlers under `apps/web/app/api`. A parallel Fastify service duplicates auth, validation, DB access and types for zero MVP gain. Revisit only if a non-Next consumer (the Python agent) needs a stable external API. |
| Prisma | **Keep Drizzle** | 8 migrations already applied to Neon; schema-first SQL is auditable. |
| Python 3.12 agent service | **Defer** | Zero `.py` files today. The Node worker already covers discovery/execution. A second runtime doubles the surface before the MVP pipeline is proven. Keep Jev behind the `packages/ai` provider abstraction (`jev.ts`) so it can move behind an HTTP boundary later without touching callers. |
| `applications` + `environments` tables | **Keep `projects` + add `environments`** | Renaming `projects` → `applications` churns every route, hook and test for zero functional gain. `environments` is genuinely missing and gets added. |
| `organizations` + tenancy | **Defer to a later phase** | Only a `users` table exists today. Retrofitting org-scoping into 18 tables mid-MVP is high-risk. Plan for it (all new tables take `projectId`/`organizationId`-ready shapes) but do not migrate existing data yet. |
| Anthropic provider | **Add later** | `packages/ai` has `openai`, `local`, `mock` today. `gemini` and `jev` are being added now; Anthropic is a small additive file once a key exists. |
| React Flow application map | **Build in the dashboard phase** | Needs the application-model read API first. |
| MinIO / S3 / R2 | **Add MinIO to compose now**, S3 env keys now | Code path exists; only config is missing. |

### Invariant to preserve (the spec demands it, the repo already does it)

> AI → structured action → validation → Playwright → independent assertion.

`packages/ai` never emits Playwright code. `test-planner.ts` / `ai-cases.ts` emit typed
structures; `test-execution/executor.ts` + `assertions.ts` interpret them. **No change
should weaken this.** A successful click is never a PASS on its own.

---

## 3. Gap analysis: specification vs. this repository

Verified against the working tree, not assumed.

### Already built (phases largely satisfied)

- Discovery pipeline with Playwright (`apps/worker/src/discovery`), browser primitives in
  `packages/browser`: element collector, action detector, navigation detector, page
  analyzer, locator resolution, DOM redaction, page model.
- Test generation (`test-generation/` + `scenarios/`), AI test planner, executor with
  assertions, locators, naming, processor.
- Credentials: AES-256-GCM crypto, discovery-derived dynamic field maps, role-scoped
  storage, encrypted at rest, values never returned to the browser.
- Workflow inference (`workflows/builder.ts`) and `stateTransitions` table.
- BullMQ + IORedis discovery queue; storage abstraction (local + S3).
- Web app: 12 screens, 24 API routes, auth (signup/login/me/logout).
- Docker Compose for `db`, `redis`, `demo-app`, `web`, `worker`.

### Genuinely missing (this is the real backlog)

| Spec area | Current state | Gap |
| --- | --- | --- |
| **Route normalization** | `discovered_pages` stores `url` only — no `routePattern`, no `canonicalUrl` | `/materials/123` and `/materials/456` never collapse to `/materials/:id`. Blocks dynamic-route testing. |
| **Deep links** | No `navigation_edges` table. `parentPageId` is a single-parent tree | A page reachable from Materials, Search *and* Notifications keeps only one parent. Spec §4 needs one row per source→target edge with confidence. |
| **Page vs UI state** | `pageType` column exists; no `ui_states` | Modal/drawer/tab/filter states are not modelled as distinct non-routes. Spec §5. |
| **Change-aware discovery** | No fingerprint, no `application_versions` | Cannot reuse or diff a model across runs. Spec §18. |
| **Coverage engine** | No coverage table or engine; only incidental matches | Spec §15 — the single largest missing feature. |
| **Findings / failure grouping** | No `findings` table, no root-cause grouping | Spec §16 `BUG-023` grouping does not exist. |
| **Failure classification** | Not implemented as a taxonomy | The 13-value classification in spec §16 is absent. |
| **Environments** | Single `startUrl` per module | Spec needs first-class environments. |
| **Roles / permissions / RBAC tests** | Credentials carry a `role` string; no `roles`/`permissions` tables, no negative authorization tests | Spec §9. |
| **Reports & exports** | One module report route + screen; no `reports` table | No CSV/XLSX/PDF/JSON export. |
| **SSRF protection** | Nothing — no private-IP or metadata-IP guard anywhere | Spec §25. **See conflict below.** |
| **Evidence model** | `discoveryArtifacts` exists; no unified `evidence` table for execution | Traces/DOM/console/network are not stored per result. |
| **`ai_generations` audit** | Not stored | No record of which model produced which test case. |
| **Organizations** | Only `users` | Deferred per §2. |

### Conflict that must be resolved before SSRF work

The spec says "block localhost/private IPs by default". This repo's development target is
the local `demo-app` and a mock browser. A default-deny SSRF guard would break the demo
flow and the existing seeded project.

Resolution: implement `isBlockedTarget()` in `packages/core` with an explicit
`SSRF_ALLOWED_HOSTS` allowlist plus `SSRF_ALLOW_PRIVATE=true` for development, and unit
test the blocklist (RFC1918, `169.254.169.254`, IPv6 loopback/link-local, decimal and hex
IP obfuscation). Deny is the production default; the allowlist is the dev escape hatch.

---

## 4. Data model additions

One migration per concern, in this order. Each is additive; no destructive change to
existing tables in the MVP.

1. `0010_discovered_page_route_pattern.sql` — `discovered_pages.route_pattern`,
   `canonical_url`, `page_fingerprint`, `dom_fingerprint`.
2. `0011_navigation_edges.sql` — `navigation_edges` (source_page_id, target_page_id,
   trigger_action_id, edge_type, route_before, route_after, confidence, session_id).
3. `0012_ui_states.sql` — `ui_states` (page_id, kind, trigger_action_id, label,
   fingerprint).
4. `0013_environments.sql` — `environments` (project_id, name, base_url, is_production).
   Backfill `modules.startUrl` into a default environment, then keep both in step.
5. `0014_roles_permissions.sql` — `roles`, `permissions`, `role_permissions`.
   Backfill from `credentials.role`.
6. `0015_coverage.sql` — `coverage_targets`, `coverage_links`, `coverage_records`
   (see below).
7. `0016_findings.sql` — `findings` (fingerprint, title, severity, failure_class,
   affected_result_ids, sample_evidence_id).
8. `0017_evidence.sql` — `evidence` (test_result_id, kind, storage_key, url, byte_size,
   captured_at, duration_ms).
9. `0018_reports.sql` — `reports` (application/project scope, format, storage_key,
   status, parameters).
10. `0019_application_versions.sql` — `application_versions` + `ai_generations`.

### Coverage engine design

Coverage is measured over **role × action**, and both linkages are stored so the dashboard
can answer "is this covered?" and "what does this test cover?" without a second query.

Three tables, not one:

| Table | Grain | Purpose |
| --- | --- | --- |
| `coverage_targets` | one row per measured thing | `dimension` ∈ `page`, `module`, `action`, `role`, `role_action`, `workflow`, `state`, `transition`, `test_type`; `target_id`; `label`; `application_version_id` |
| `coverage_links` | one row per (target, test case, role) | The many-to-many linkage, unique on `(coverage_target_id, test_case_id, role_id)`. This is the "both linkages" requirement: target → tests and test → targets are the same rows read in opposite directions. |
| `coverage_records` | one row per target | Denormalized rollup (`total_tests`, `passed`, `failed`, `blocked`, `coverage_pct`, `last_evaluated_at`) so dashboard reads never recompute. |

- `role_id` is nullable on a link. A test with no role dimension covers the target for
  every role; `role_action` targets always set it.
- `role_action` is a real target grain, not a derived view: Analyst → Create and
  Approver → Create are separate coverage obligations, and Analyst → Approve is a
  negative-obligation target.
- A coverage **gap is not a bug**. Gaps feed the test generator and the dashboard backlog;
  they never create a finding.
- `coverage_records` is a cache over `coverage_links`, recomputed after each test run. It is
  never the source of truth.

---

## 5. Phased plan

Status is against the current tree. `Partial` means the mechanism exists but not the
spec behaviour.

| Phase | Scope | Status | Exit criterion |
| --- | --- | --- | --- |
| **0** | Nameless-login-field fix (code + password assignment) | **Handed off** | Not owned by this plan. See §7 decision 1. |
| **1** | Foundations | Done | Neon + Drizzle + BullMQ + storage + crypto + web/worker/compose. |
| **2** | Onboarding: environments, roles | Partial | Environments + roles tables, UI, credential scoping. |
| **3** | Discovery | Partial | Add route normalization + fingerprints (migration 0010). |
| **4** | Application model: navigation edges + UI states | Not started | Migrations 0011–0012; `GET /application-model` assembles the three layers. |
| **5** | Role/RBAC discovery | Not started | Migration 0014; positive + negative authorization cases per role. |
| **6** | Workflow discovery | Partial | Transitions exist; add `workflow_transitions` and ambiguity + human confirmation. |
| **7** | Autonomous exploration (Jev) | Partial | Provider exists behind `packages/ai`; needs real key + typed action loop. |
| **8** | AI test generation | Partial | Structured generation exists; add `ai_generations` audit + edge-case matrix. |
| **9** | Playwright execution + verification | Done | Executor asserts independently; never PASS on click alone. |
| **10** | Evidence | Partial | Migration 0017 + MinIO in compose + S3 env keys. |
| **11** | Coverage engine | Not started | Migration 0015; per-dimension coverage with explicit gap lists. |
| **12** | Failure analysis | Not started | Migration 0016; classification taxonomy + root-cause grouping. |
| **13** | Reports + export | Partial | Migration 0018; CSV/XLSX/PDF/JSON export. |
| **14** | Dashboard: Application Map, coverage, failures | Partial | React Flow map; coverage and findings screens. |

**Critical path:** Phase 4 → 11 → 12 → 13. The application model gates coverage, findings
and reports, so route normalization and navigation edges come before any dashboard work.
Phase 0 is tracked separately and is not on this path.

---

## 6. Explicitly deferred (post-MVP)

- Python agent service and its `/discover` `/explore` `/execute` `/analyze` HTTP API.
- Fastify as a standalone API tier.
- Organization tenancy and per-tenant isolation retrofit.
- Anthropic provider (and any provider lacking a key).
- Playwright video for critical failures.
- Configurable evidence retention jobs.
- Multi-step / MFA authentication (needs ordered form-step data; the flat field map
  cannot represent it).
- S3/R2 production verification (needs bucket, region, endpoint, credentials).

---

## 7. Decisions taken

| # | Question | Decision |
| --- | --- | --- |
| 1 | Concurrent editor / orphaned `login-fields.ts` | **Stop.** Leave `action-space.ts`, `action-space.test.ts` and `login-fields.ts` untouched. The nameless-login-field fix is owned outside this plan. |
| 2 | Organization tenancy | **Deferred.** Single-tenant `users` for the MVP, but every new table is shaped so `organizationId` can be added later without rewriting them. |
| 3 | Naming | **Unchanged.** `projects` + `modules` + `environments`. No rename to `applications`. |
| 4 | Coverage definition | **Role × action, both linkages.** Three-table design in §4. |

### Still open (non-blocking)

- **SSRF dev allowance** — confirm `SSRF_ALLOW_PRIVATE=true` is acceptable in development,
  or the demo target must move off localhost. Blocks the security slice only.
- **Report formats** — which of CSV / XLSX / PDF / JSON are MVP-required? Blocks phase 13
  only.

---

## 8. Risks

- **Concurrent editing.** A second process is editing
  `apps/worker/src/discovery/action-space.ts`. Work on this plan should avoid that file
  until its owner finishes; only discovery internals are blocked by this.
- **Orphaned code.** `apps/worker/src/discovery/login-fields.ts` is deliberately parked and
  unimported. It must eventually be integrated or deleted — but not silently.
- **Schema/DB drift.** This already happened once: `input_type` existed in the Drizzle
  schema with no migration, so password detection never reached the database. Rule: every
  schema change ships with its migration in the same change.
- **Compose vs Neon.** `docker/docker-compose.yml` defines a local `db` service while
  development actually targets Neon. Document which is authoritative or the two paths
  will diverge silently.