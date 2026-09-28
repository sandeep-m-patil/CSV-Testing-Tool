# Configuration

All env vars are **app-scoped** — the web app, worker, and db package read their own `.env` files in their own directory. `.env*` is git-ignored, so assets like the Neon connection URL and generated keys never enter the repo.

> This project does **not** use Docker for the database in development. Postgres runs on **Neon**; Redis is still external (local, cloud, or `docker compose up redis`).

## 1. `apps/web/.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Pooled** Neon URL used at runtime (`sslmode=require`). |
| `REDIS_URL` | BullMQ/health Redis, e.g. `redis://localhost:6379`. |
| `AUTH_SECRET` | Session signing secret (≥ 32 chars; random recommended). |
| `CREDENTIAL_ENCRYPTION_KEY` | base64, exactly 32 bytes: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `STORAGE_DRIVER` | `local` (default) or `s3`. |
| `STORAGE_LOCAL_DIR` | Where local evidence lives; web + worker share `../data/storage`. |
| `STORAGE_PUBLIC_BASE_URL` | Base URL for public storage URLs, `http://localhost:3000`. |
| `NEXT_PUBLIC_APP_URL` | Public app base URL, `http://localhost:3000`. |
| `AI_PROVIDER` | ⚠️ Read but **has no effect** — the provider is never invoked. Defaults to `mock`. See `tech-stack.md` § AI and agent integration status. |

## 2. `apps/worker/.env`

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Pooled Neon URL (same as web). | — |
| `REDIS_URL` | Job queue Redis. | — |
| `CREDENTIAL_ENCRYPTION_KEY` | Matching encryption key (must equal web's). | — |
| `BROWSER_HEADLESS` | Run Chromium headless. | `true` |
| `BROWSER_ISOLATED_CONTEXT` | Isolated incognito-like context. | `true` |
| `DISCOVERY_MAX_PAGES` | Page budget per session. | `20` |
| `DISCOVERY_MAX_STEPS` | Total executed-step budget. | `200` |
| `DISCOVERY_NAVIGATION_DEPTH` | BFS depth for exploration. | `3` |
| `DISCOVERY_MAX_ACTIONS_PER_PAGE` | Candidate actions considered per page. | `8` |
| `DISCOVERY_TIMEOUT_MS` | Per-action timeout. | `30000` |
| `DISCOVERY_PAGE_SLEEP_MS` | Pause between pages. | `350` |
| `WORKER_CONCURRENCY` | Parallel discovery jobs (1–8). | `2` |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` / `STORAGE_PUBLIC_BASE_URL` | Same as web. | — |
| `AI_PROVIDER`, `OPENAI_*`, `LOCAL_AI_*` | ⚠️ Accepted but **unused** — no AI provider is ever called, and there is no Gemini implementation. Defaults to `mock`. | `mock` |

## 3. `packages/db/.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Unpooled** Neon URL — used by `drizzle-kit`/seed so migrations aren't routed through the pooler. |
| `DEMO_APP_URL` | Seeded demo target, `http://localhost:4000`. |

## 4. Using Neon (recommended)

Environment block (your instance):

```env
DATABASE_URL=postgresql://neondb_owner:...@ep-...-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:...@ep-....c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

- Remove `channel_binding=require` from both URLs — it is a libpq-only parameter and will be rejected by the Drizzle/JS driver.
- Keep `sslmode=require`.

Optional Neon add-ons:

- **Neon Auth** — `NEON_AUTH_BASE_URL` / `NEON_AUTH_JWKS_URL` for JWT verification (not wired yet).
- **Neon S3-compatible storage** — endpoint + credentials. You must create a **bucket** and set `S3_BUCKET` before enabling `STORAGE_DRIVER=s3`; path-style addressing is already handled.

## 5. Object storage (S3)

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<host>.storage.c-3.<region>.aws.neon.tech
S3_REGION=ap-southeast-1
S3_BUCKET=<created bucket name>
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

The S3 driver uses `forcePathStyle` automatically when a custom endpoint is set (required for Neon S3).

## 6. Redis

Discovery needs Redis for the BullMQ queue.

```bash
docker compose up redis        # local container on :6379
```

or set `REDIS_URL` to any managed Redis (e.g. Upstash, Redis Cloud). The web app itself boots without Redis, but `POST /discover` returns `503 REDIS_UNCONFIGURED` and `/api/health` reports `degraded`.

## 7. Root `.env.example`

The root `.env.example` documents all of the above as copyable blocks. `packages/db` (migrations/seed) and `apps/*` each also ship a `.env.example` mirroring their variables.

## Secrets checklist

- `AUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, Neon password, S3 keys — never commit, never log.
- Rotate `CREDENTIAL_ENCRYPTION_KEY` only via a re-encryption migration; losing it makes stored credential secrets unrecoverable.