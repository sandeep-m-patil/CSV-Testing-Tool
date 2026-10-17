import { and, eq, gt, sql } from "drizzle-orm";
import { discoveryArtifacts, discoverySessions, jobQueue } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { noContent, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

type Params = { params: Promise<Record<string, string>> };

/** A worker heartbeats every 15s; a lock older than this belongs to a crashed worker. */
const LIVE_LOCK_MS = 120_000;
const jobForSession = (sessionId: string) => sql`${jobQueue.data}->>'discoverySessionId' = ${sessionId}`;

/** True only while a worker is actually executing this run right now. */
async function isBeingExecuted(sessionId: string): Promise<boolean> {
  const [live] = await db
    .select({ id: jobQueue.id })
    .from(jobQueue)
    .where(and(jobForSession(sessionId), eq(jobQueue.status, "running"), gt(jobQueue.lockedAt, new Date(Date.now() - LIVE_LOCK_MS))))
    .limit(1);
  return Boolean(live);
}

/**
 * Deletes one discovery run: its pages, elements, actions, workflows, logs and
 * evidence rows (database cascade) and its screenshot files. Test cases it
 * generated are kept; their link to the run is cleared. A queued run is
 * cancelled with it. A run a worker is executing right now is refused, so the
 * worker never writes into a deleted run; a run orphaned by a crash can go.
 */
export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const params = await context.params;
  const moduleId = params["moduleId"]!;
  await requireModuleAccess(moduleId, session);

  const [run] = await db
    .select()
    .from(discoverySessions)
    .where(and(eq(discoverySessions.id, params["sessionId"]!), eq(discoverySessions.moduleId, moduleId)))
    .limit(1);
  if (!run) throw new AppError("NOT_FOUND", "Discovery run not found", 404);
  if (await isBeingExecuted(run.id)) throw new AppError("RUN_ACTIVE", "This discovery run is executing right now; delete it after it finishes", 409);
  await db.delete(jobQueue).where(and(jobForSession(run.id), eq(jobQueue.status, "queued")));

  // Keys are read before the cascade removes the rows that hold them.
  const keys = (await db.select({ key: discoveryArtifacts.storageKey }).from(discoveryArtifacts).where(eq(discoveryArtifacts.discoverySessionId, run.id))).map((row) => row.key);
  await db.delete(discoverySessions).where(eq(discoverySessions.id, run.id));

  // Best effort: the run is gone either way, so a storage hiccup must not fail the delete.
  const storage = getStorage();
  await Promise.all(keys.map((key) => storage.delete(key).catch(() => undefined)));
  return noContent();
});
