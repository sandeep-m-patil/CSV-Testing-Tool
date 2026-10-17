import { and, eq, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { jobQueue } from "./schema/jobs";

/**
 * A durable job queue in Postgres. Jobs survive restarts, retry with
 * exponential backoff, and are claimed with FOR UPDATE SKIP LOCKED so any
 * number of workers can share one queue without taking the same job twice.
 */

// Structural type so this module does not need the full schema generic.
type QueueDb = PostgresJsDatabase<Record<string, unknown>>;

export interface QueueJob<T> {
  id: string;
  name: string;
  data: T;
  /** 1 on the first try. */
  attempt: number;
  maxAttempts: number;
}

export interface EnqueueInput<T> {
  queue: string;
  name: string;
  data: T;
  maxAttempts?: number;
  backoffMs?: number;
}

const DEFAULT_BACKOFF_MS = 5_000;
const MAX_ERROR_LENGTH = 2_000;

export async function enqueueJob<T>(db: QueueDb, input: EnqueueInput<T>): Promise<string> {
  const [row] = await db
    .insert(jobQueue)
    .values({
      queue: input.queue,
      name: input.name,
      data: input.data as unknown as object,
      maxAttempts: input.maxAttempts ?? 1,
      backoffMs: input.backoffMs ?? DEFAULT_BACKOFF_MS,
    })
    .returning({ id: jobQueue.id });
  if (!row) throw new Error("Could not enqueue job");
  return row.id;
}

interface ClaimedRow extends Record<string, unknown> {
  id: string;
  name: string;
  data: unknown;
  attempts: number;
  max_attempts: number;
}

/** Atomically takes the oldest ready job of a queue, or returns null when none is ready. */
export async function claimJob<T>(db: QueueDb, queue: string, workerId: string): Promise<QueueJob<T> | null> {
  const rows = await db.execute<ClaimedRow>(sql`
    UPDATE ${jobQueue}
    SET status = 'running', attempts = attempts + 1, locked_at = now(), locked_by = ${workerId}, updated_at = now()
    WHERE id = (
      SELECT id FROM ${jobQueue}
      WHERE queue = ${queue} AND status = 'queued' AND run_after <= now()
      ORDER BY run_after, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, name, data, attempts, max_attempts`);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, data: row.data as T, attempt: row.attempts, maxAttempts: row.max_attempts };
}

export async function completeJob(db: QueueDb, id: string): Promise<void> {
  await db
    .update(jobQueue)
    .set({ status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null, updatedAt: new Date() })
    .where(eq(jobQueue.id, id));
}

/** Requeues with exponential backoff while attempts remain; otherwise marks the job failed. */
export async function failJob(db: QueueDb, job: Pick<QueueJob<unknown>, "id" | "attempt" | "maxAttempts">, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
  const hasRetriesLeft = job.attempt < job.maxAttempts;
  await db
    .update(jobQueue)
    .set({
      status: hasRetriesLeft ? "queued" : "failed",
      lastError: message,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
      ...(hasRetriesLeft
        ? { runAfter: sql`now() + make_interval(secs => ${jobQueue.backoffMs} * power(2, ${job.attempt - 1}) / 1000.0)` }
        : { completedAt: new Date() }),
    })
    .where(eq(jobQueue.id, job.id));
}

/** Renews a running job's lock so it is not mistaken for an abandoned one. */
export async function heartbeatJob(db: QueueDb, id: string): Promise<void> {
  await db.update(jobQueue).set({ lockedAt: new Date() }).where(and(eq(jobQueue.id, id), eq(jobQueue.status, "running")));
}

/**
 * Returns jobs whose worker stopped heartbeating (crash, kill, deploy) to the
 * queue, or fails them when they have no attempts left.
 */
export async function recoverStaleJobs(db: QueueDb, queue: string, staleMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const stale = and(eq(jobQueue.queue, queue), eq(jobQueue.status, "running"), lt(jobQueue.lockedAt, cutoff));
  const requeued = await db
    .update(jobQueue)
    .set({ status: sql`CASE WHEN ${jobQueue.attempts} < ${jobQueue.maxAttempts} THEN 'queued' ELSE 'failed' END`, lastError: "worker stopped responding", lockedAt: null, lockedBy: null, updatedAt: new Date() })
    .where(stale)
    .returning({ id: jobQueue.id });
  return requeued.length;
}
