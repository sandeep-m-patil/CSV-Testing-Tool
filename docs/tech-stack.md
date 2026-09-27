# Tech Stack

| Area | Choice | Notes |
| --- | --- | --- |
| Monorepo | pnpm workspaces 9, `apps/*` + `packages/*` | `packageManager: pnpm@9.12.0`, Node ≥ 20 |
| Language | TypeScript ~5.9 (strict, `noUncheckedIndexedAccess`) | Single language across the stack |
| Web | Next.js 15.5 (App Router) | Port **3000**, Server Components + client features, React Query |
| API | Next.js Route Handlers | Envelope `{ data, meta, error }`, central `route()` wrapper |
| Worker runtime | `tsx` (ESM) | Long-lived BullMQ consumer process |
| Browser automation | Playwright ~1.49 | Chromium, headless by default |
| Queue | BullMQ 5 (+ ioredis) | Single `discovery` queue |
| Database | PostgreSQL 16 via **Neon** (serverless) | Drizzle ORM ~0.38, `drizzle-orm/neon-http` driver |
| Migrations | Drizzle Kit | `pnpm db:migrate`, applied against the unpooled URL |
| Validation | Zod 3 | Shared input/output schemas in `@repo/schemas` |
| Auth | Session cookie (hand-rolled, no provider) | `AUTH_SECRET`-signed sessions; login/signup/me/logout routes |
| Encryption | Node `crypto` AES-256-GCM | Module credential secrets at rest |
| Object storage | Local filesystem or S3-compatible | `forcePathStyle` enabled for Neon S3; served back through `/storage/*` |
| AI | Adapter pattern: `mock` / `local` / `openai` | Deterministic fallback, AI optional |
| Styling | Tailwind (v4), shadcn-style `components/ui` | |
| Data fetching | TanStack React Query v5 | `features/hooks.ts` + per-feature queries |
| Logging | Pino (`createChildLogger`, `logger`) | Structured, secret-free |
| Testing | Vitest | Per-workspace scripts; E2E/scoring still to come (see roadmap) |
| Linting | ESLint 9 flat config + Prettier | |
| Infra (optional) | Docker Compose | Postgres 16, Redis 7, demo-app, web, worker; **DB now runs on Neon in dev** |

## Dependency ownership (pnpm strict)

Because pnpm resolves strictly, every package that imports a runtime dependency declares it directly:

- `apps/web` imports `drizzle-orm` (route queries) and `ioredis` (health ping) — declared as deps of `@repo/web`.
- `apps/worker` imports `bullmq` (its own `Worker` wiring) — declared as a dep of `@repo/worker`.
- `@repo/core` exposes queue + storage + errors; `@repo/browser` owns all Playwright interaction; `@repo/db` owns schema + client.

## Browser engines

Chromium is downloaded via Playwright, not bundled in the repo. Install once per environment:

```bash
pnpm --filter @repo/worker exec playwright install chromium
```