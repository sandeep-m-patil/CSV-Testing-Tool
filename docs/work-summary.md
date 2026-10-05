# Work Summary

Session covering route normalization, database reconciliation, AI providers, and the UI.

## 1. Route normalization

New `packages/browser/src/route-pattern.ts`, exported from the package index.

- `normalizeRoute(input)` — collapses a URL to a route pattern. `/materials/123`
  and `/materials/456` both become `/materials/:id`. Query and hash are dropped,
  since they express filter state rather than identity.
- `canonicalUrl(input)` — stable identity for deduplication. Drops the hash and
  tracking parameters (`utm_*`, `gclid`, `fbclid`, `msclkid`), sorts the rest.
- `isDynamicSegment(segment)` — only unambiguous identifier shapes collapse:
  numeric, ISO date, UUID, Mongo ObjectId, ULID, and long hex tokens.

Static words deliberately stay static. `materials`, `sign-up`, and `v1` are not
identifiers; collapsing them would merge every static route into one pattern and
destroy the Application Model's structure.

21 unit tests in `route-pattern.test.ts` cover those cases plus trailing
slashes, relative paths, root, query/hash handling, and parameter ordering.

## 2. Database reconciliation

Neon was three migrations ahead of the repository. The working tree had been
reset to commit `0235a58` at 21:31, which removed migration files `0007`–`0009`
along with all schema and code changes from an earlier session.

### Key finding

Drizzle's migrator compares **only `created_at`**, never the migration hash.
Verified by reading `node_modules/drizzle-orm/pg-core/dialect.cjs`:

```js
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) { ... }
```

The recorded `created_at` is the journal's `when` value, so matching `when`
entries are sufficient to prevent re-execution. Hash equality was never
required — my earlier plan assumed otherwise.

### Actions

- Reconstructed `0007_credential_dynamic_fields.sql`, `0008_discovered_element_input_type.sql`,
  and `0009_credential_form_type.sql`.
- Added journal entries at `when` values `1790508000000`, `1790509000000`, and
  `1790510000000`, matching Neon's records.
- Normalised new files to LF with a trailing newline, matching the existing
  migration convention.
- Confirmed via a read-only dry check that **0 migrations would execute**. Neon
  remained at 10 rows, max `when` `1790510000000`. `pnpm migrate` was never run;
  Neon received no writes.
- `0007` and `0008` hash-match Neon's recorded values. `0009` does not — the
  original text is unrecoverable from the column definition alone, and since it
  never executes the mismatch is inert. Its `IF NOT EXISTS` makes it safe on a
  fresh database.

### Schema alignment

Columns exist in Neon but were missing from the Drizzle schema, which meant
`db:generate` would have proposed dropping them. Aligned:

- `credentials.username` now nullable
- `credentials.fieldKeys` `jsonb`, defaults to `[]`
- `credentials.formType` `varchar(16)`, defaults to `login`
- `discoveredElements.inputType` and `.autocomplete`

Nullable `username` surfaced six type errors across web and worker. Each was
fixed at its boundary: the PATCH route falls back to `""`, `loadCredentials`
only builds a run credential when both halves exist, and `AuthCredential.username`
is now `string | null`.

Note `encryptCredentials` still assumes a username+password pair. Field-keyed
credentials remain part of the handed-off dynamic-credential work.

## 3. AI providers

Both were specified and missing. `docs/requirements.md` §12.5 and §12.6 were open,
and §12.6 was the larger miss: even the existing providers were constructed in
the worker but only `.label` was ever read, so `interpretPage` and
`analyzeWorkflows` had zero call sites.

### Added

- **Gemini** (`packages/ai/src/gemini.ts`) — `generateContent` with
  `responseMimeType: application/json`, via raw `fetch` to match the existing
  OpenAI adapter's no-SDK convention.
- **Grok** (`packages/ai/src/grok.ts`) — extends `OpenAICompatibleProvider`
  against xAI's OpenAI-compatible endpoint at `https://api.x.ai/v1`. Defaults to
  `grok-4.6`.
- `AIProviderKind` extended to `mock | openai | gemini | grok | local`, with
  matching factory cases, env schema entries, and worker config wiring.
  `OpenAICompatibleOptions` gained an optional `kind` override so Grok reports
  its own identity.

Both are gated behind `GEMINI_API_KEY` / `XAI_API_KEY` and default to `mock`, so
the pipeline still runs with no AI configured.

### Leak found and fixed

A test asserting no credential material reached the provider failed and exposed a
real defect: `AiElement.name` was forwarded verbatim, so an element whose `name`
reflected filled-in data would leak it. Requirement §12.8 was previously marked
DONE only vacuously, since no provider was ever called.

Added `packages/ai/src/sanitize.ts`, applied to both adapters. It normalises
values before matching, because identifiers are usually joined —
`user_password`, `authToken`, `x-api-key` — and a raw `\b` boundary misses all of
them since `_` is a word character in JavaScript regexes. Structure (roles,
element types, non-sensitive placeholders) is preserved so the model can still
reason about the page; only credential-shaped values become `[redacted]`.

13 tests in `packages/ai/src/gemini-grok.test.ts` cover factory construction,
missing-key errors, request shape and headers, HTTP error propagation, schema
rejection of malformed replies, and redaction.

### Vitest/zod fix

Tests failed to load with `Cannot find module '.../zod/v3/external'`. Cause:
`zod@3.25.76` ships `index.js` with extensionless relative imports. Bundlers and
`tsx` resolve those, but Vitest externalises `node_modules` and strict ESM does
not. Added `packages/ai/vitest.config.ts` with `server.deps.inline: ["zod"]`.

## 4. UI

Dark-only, mobile responsive, shadcn/ui.

- **Dark is the only theme.** Removed the light token block; `:root` and `.dark`
  now both carry the dark palette, so a stale `class="light"` cannot flip the app
  back. Set `color-scheme: dark` so the browser never paints a light surface.
- **`forcedTheme="dark"`** in the provider, replacing `defaultTheme="system"`, so
  a stored preference or system light mode cannot win.
- **`ThemeToggle` now renders `null`.** There is nothing to toggle; keeping a
  control that cannot change anything is worse than removing it. The module
  remains as the import site if a switcher returns.
- **Semantic status tokens everywhere.** Replaced hardcoded `emerald-500`,
  `red-400`, `amber-500`, and all `slate-*` usage in the sidebar, status icons,
  stat tiles, result grids, log console, and credential manager with
  `success` / `destructive` / `warning` / `muted-foreground`.
- **`Alert` variants were light-only** (`bg-amber-50 text-amber-900`) and
  unreadable on dark. Now tinted backgrounds: `border-warning/50 bg-warning/10`.
- **Responsive touch targets.** Added `touch` (44px) and `iconTouch` sizes,
  `shrink-0` on interactive elements, `aria-current` on active nav, `aria-expanded`
  on the mobile menu button, `min-w-0` + `truncate` on the user block, and a wider
  mobile drawer (`w-72 max-w-[85vw]`).
- Added dark scrollbars, a selection colour, and a `prefers-reduced-motion` block.
- The `@media print` block was left intact; it already forces dark ink on white
  paper, which is required for report printing.

## Verification

- `pnpm -r typecheck` — clean across all 8 packages.
- `pnpm --filter @repo/web build` — succeeds; 24 API routes and 13 pages.
- `pnpm --filter @repo/ai test` — 13 passed.
- `pnpm --filter @repo/browser test` — 21 passed.
- `pnpm --filter @repo/demo-app test` — 1 passed.
- `pnpm lint` — 23 pre-existing warnings, 0 errors.

Two pre-existing gaps worth noting: `packages/db`, `packages/core`,
`packages/schemas`, `apps/worker`, and `apps/web` still have no test files, so
root `pnpm -r test` exits 1. The only other tracked test in the repo is
`apps/demo-app/src/app.test.ts`; browser tests from before the 21:31 reset were
lost.

## Still open

- `interpretPage` / `analyzeWorkflows` are implemented and tested but have **no
  call sites yet** — §12.6 remains incomplete until discovery actually invokes
  the provider.
- §12.11, the web route for AI generation, is still missing.
- Jev (§13.1, §13.2) is not started. `browser-use/jev-ultrafast` is Python and
  drives Chrome over CDP rather than Playwright; `@tontoko/jev-browser` wraps an
  existing Playwright page and is the viable bridge here. It needs
  `TYPESAFE_API_KEY` plus a text-model key, neither present.
- Migration `0010` for route patterns is not written yet; it becomes safe to add
  now that the journal is reconciled.
- SSRF development allowance and MVP report formats remain undecided.

---

# Work Summary — Part 2

Application model, AI wiring, coverage, findings, and report exports. Builds on
the work above; all of its "still open" items are now closed except live
credential verification.

## 5. Application model persistence

Migrations `0010`, `0011` and `0012` were added and applied to Neon.

- `0010` adds `route_pattern`, `canonical_url`, `page_fingerprint` and
  `dom_fingerprint` to `discovered_pages`.
- `0011` creates `ui_states` and `navigation_edges`.
- `0012` adds `ai_page_type`, `ai_purpose`, `ai_fields`, `ai_actions`,
  `ai_source` and `role`.
- `0013` creates `environments`, `coverage_targets`, `coverage_links`,
  `coverage_records`, `finding_groups` and `findings`, and adds the foreign keys
  `0011` omitted.

Verified against Neon with a throwaway script after applying, then deleted.

`page-identity.ts` derives a page's identity from route pattern, canonical URL
and a hash of its structural DOM, so the same page reached by two URLs is one
page, while a genuinely different view of it is a new UI state. 10 tests.

## 6. AI wired into discovery

- `interpretPageWithFallback` calls the provider with a timeout and a redacted
  context, and falls back to the deterministic heuristic on error, timeout or
  malformed output. 6 tests.
- `runner.ts` persists the result per page; `store.ts` stores it.
- `enrichWithAiAnalysis` in the workflow builder calls `analyzeWorkflows` after
  workflows are built. **It is advisory only** — candidates are logged, never
  turned into executable cases. Test generation remains deterministic.
- `apps/web/app/api/modules/[moduleId]/ai/route.ts` serves the Application Model
  and page interpretation. The page snapshot is rebuilt from what discovery
  stored rather than taken from the request body, so the model only ever sees
  data this platform collected. `@repo/ai` was added to `apps/web/package.json`
  for this.

## 7. SSRF

`url-guard.ts` and `ssrf-guard.ts` in `packages/core` (22 tests) reject private
and non-HTTP targets, resolve DNS, and re-check through redirects. Project create
and update now call `safeUrlError` before writing, so a rejected target never
becomes a failed run.

`ALLOW_PRIVATE_TARGETS` defaults to `false`. The local demo app runs on
`localhost`, so development needs it set to `true` explicitly.

## 8. Semantic target resolution

`semantic-target.ts` is the last link in the locator fallback chain. A target is
described as *what the user means*, never as a selector; the agent answers with
a description and Playwright still performs the lookup. Anything sent out is
redacted, and every error is a miss rather than a failure. 9 tests.

The Jev package itself is still not installed, so the resolver is inert until
`JEV_API_KEY`, `JEV_BASE_URL` and a text-model key are configured.

## 9. Coverage, findings, reports

- `coverage/engine.ts` measures role × action from run results. The worst
  outcome across attempts wins, a skip is not coverage, and a target with no
  linked test case is reported separately from one whose tests never ran —
  because the fix differs. 8 tests.
- `findings/grouping.ts` fingerprints findings from category, title, page and
  normalised detail, excluding run, environment, evidence key and severity, so
  one defect keeps one history and an escalation does not start a new group. 14
  tests.
- `report-export.ts` formats a report as JSON, HTML, CSV or JUnit, served by
  `api/modules/[moduleId]/report/export?format=…`. CSV and JUnit flatten to one
  row per test case, which is what CI and spreadsheets expect. 10 tests.

## 10. Verification

- `pnpm -r typecheck` — 8 of 8 packages clean.
- Tests: core 22, ai 13, browser 21, worker 47, web 10, demo-app 1.
- `pnpm --filter @repo/web build` — succeeds.
- `pnpm lint` — 0 errors, 22 warnings, all pre-existing.

`packages/db` still has no test files, so root `pnpm -r test` exits 1. That is
unchanged and is the reason the root test script fails rather than any test.

## Still open

- Live Gemini and Grok calls are unverified: `GEMINI_API_KEY` and `XAI_API_KEY`
  are not configured. The adapters are unit-tested against mocked HTTP.
- Jev live verification needs `TYPESAFE_API_KEY` plus a text-model key.
- CSV data-driven execution is still incomplete: the UI and server disagree on
  the payload shape, and `loadCases()` does not run one case per row.
- Dynamic credential fields remain constrained by the auth handoff, in which
  `action-space.ts` is protected and `encryptCredentials` handles a
  username/password pair only.
- Coverage and findings engines are computed and tested, but not yet called
  during a test run, so no `coverage_records` or `findings` rows are written.
