import { randomUUID } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { claimJob, completeJob, failJob, heartbeatJob, recoverStaleJobs, type QueueJob } from "./job-queue";

/**
 * Polls one queue and runs up to `concurrency` jobs at a time. Polling (rather
 * than LISTEN/NOTIFY) is deliberate: pooled serverless Postgres connections,
 * such as Neon's pooler, do not keep LISTEN subscriptions.
 */

type QueueDb = PostgresJsDatabase<Record<string, unknown>>;

export interface JobWorkerOptions<T> {
  db: QueueDb;
  queue: string;
  concurrency: number;
  handler: (job: QueueJob<T>) => Promise<void>;
  pollMs?: number;
  heartbeatMs?: number;
  /** A running job with no heartbeat for this long is considered abandoned. */
  staleMs?: number;
  onError?: (error: unknown, job?: QueueJob<T>) => void;
  onCompleted?: (job: QueueJob<T>) => void;
}

export interface JobWorker {
  readonly id: string;
  close(): Promise<void>;
}

const DEFAULT_POLL_MS = 1_000;
const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_STALE_MS = 120_000;
const RECOVERY_INTERVAL_MS = 30_000;

export function startJobWorker<T>(options: JobWorkerOptions<T>): JobWorker {
  const id = `${options.queue}-${randomUUID().slice(0, 8)}`;
  const running = new Set<Promise<void>>();
  let isClosed = false;
  let lastRecovery = 0;

  async function loop(): Promise<void> {
    while (!isClosed) {
      try {
        lastRecovery = await maybeRecover(options, lastRecovery);
        const claimed = running.size < options.concurrency ? await claimJob<T>(options.db, options.queue, id) : null;
        if (claimed) {
          const task = runJob(options, claimed).finally(() => running.delete(task));
          running.add(task);
          continue;
        }
      } catch (error) {
        options.onError?.(error);
      }
      await sleep(options.pollMs ?? DEFAULT_POLL_MS);
    }
  }

  const done = loop();
  return {
    id,
    async close() {
      isClosed = true;
      await done;
      await Promise.allSettled([...running]);
    },
  };
}

async function maybeRecover<T>(options: JobWorkerOptions<T>, lastRecovery: number): Promise<number> {
  if (Date.now() - lastRecovery < RECOVERY_INTERVAL_MS) return lastRecovery;
  await recoverStaleJobs(options.db, options.queue, options.staleMs ?? DEFAULT_STALE_MS);
  return Date.now();
}

async function runJob<T>(options: JobWorkerOptions<T>, job: QueueJob<T>): Promise<void> {
  const beat = setInterval(() => void heartbeatJob(options.db, job.id).catch(() => undefined), options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
  try {
    await options.handler(job);
    await completeJob(options.db, job.id);
    options.onCompleted?.(job);
  } catch (error) {
    options.onError?.(error, job);
    await failJob(options.db, job, error).catch((failError: unknown) => options.onError?.(failError, job));
  } finally {
    clearInterval(beat);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
