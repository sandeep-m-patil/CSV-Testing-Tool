import { asc, eq } from "drizzle-orm";
import { testRunResults, testRuns, testCases, modules } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { noContent, ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { assertSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { evidenceKeysOf, presentResult, presentRun } from "@/lib/test-run-view";

type Params = { params: Promise<Record<string, string>> };

/** Full result set for a single run, with screenshot URLs resolved for the grid. */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const { testRunId } = await context.params;

  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId!)).limit(1);
  if (!run) {
    throw new AppError("NOT_FOUND", "Test run not found", 404);
  }
  await requireModuleAccess(run.moduleId, session);

  const storage = getStorage();
  const results = await db
    .select({
      id: testRunResults.id,
      testCaseId: testRunResults.testCaseId,
      status: testRunResults.status,
      durationMs: testRunResults.durationMs,
      testData: testRunResults.testData,
      expectedResult: testRunResults.expectedResult,
      actualResult: testRunResults.actualResult,
      error: testRunResults.error,
      screenshotKey: testRunResults.screenshotKey,
      order: testRunResults.order,
      datasetId: testRunResults.datasetId,
      datasetRow: testRunResults.datasetRow,
      attempts: testRunResults.attempts,
      attemptCount: testRunResults.attemptCount,
      stepResults: testRunResults.stepResults,
      role: testRunResults.role,
      credentialName: testRunResults.credentialName,
      browser: testRunResults.browser,
      code: testCases.code,
      name: testCases.name,
      type: testCases.type,
      priority: testCases.priority,
    })
    .from(testRunResults)
    .innerJoin(testCases, eq(testRunResults.testCaseId, testCases.id))
    .where(eq(testRunResults.testRunId, run.id))
    .orderBy(asc(testRunResults.order));

  const [module] = await db.select().from(modules).where(eq(modules.id, run.moduleId)).limit(1);

  const parent = run.parentRunId ? (await db.select().from(testRuns).where(eq(testRuns.id, run.parentRunId)).limit(1))[0] : undefined;

  return ok({
    testRun: presentRun(run, parent),
    module: module ?? null,
    results: results.map((row) => presentResult(row, storage)),
  });
});

/**
 * Deletes a run, its per-case results, and the screenshot files those results
 * reference. Screenshot keys are read before the rows are removed because the
 * result cascade takes the key column with it.
 */
export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { testRunId } = await context.params;

  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId!)).limit(1);
  if (!run) {
    throw new AppError("NOT_FOUND", "Test run not found", 404);
  }
  await requireModuleAccess(run.moduleId, session);

  // Final, per-attempt and per-step screenshots are all owned by the run.
  const screenshotKeys = evidenceKeysOf(
    await db
      .select({ screenshotKey: testRunResults.screenshotKey, attempts: testRunResults.attempts, stepResults: testRunResults.stepResults })
      .from(testRunResults)
      .where(eq(testRunResults.testRunId, run.id)),
  );

  // test_run_results is removed by the foreign-key cascade on test_runs.
  await db.delete(testRuns).where(eq(testRuns.id, run.id));

  // Best effort: the run is already gone, so a storage failure must not surface
  // as a failed delete. Local driver uses `force`, S3 delete is idempotent.
  const storage = getStorage();
  await Promise.all(
    screenshotKeys.map((key) => storage.delete(key).catch(() => undefined)),
  );

  return noContent();
});
