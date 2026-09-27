import { asc, eq } from "drizzle-orm";
import { testRunResults, testRuns, testCases, modules } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

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

  return ok({
    testRun: run,
    module: module ?? null,
    results: results.map((row) => ({
      ...row,
      code: row.code ?? `TC-${String(row.order + 1).padStart(4, "0")}`,
      screenshotUrl: row.screenshotKey ? storage.getPublicUrl(row.screenshotKey) : null,
    })),
  });
});
