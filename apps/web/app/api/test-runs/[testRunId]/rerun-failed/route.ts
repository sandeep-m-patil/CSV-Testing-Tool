import { and, count, eq, inArray } from "drizzle-orm";
import { modules, testRunResults, testRuns } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { created, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueTestRun } from "@/lib/test-run";
import { presentRun } from "@/lib/test-run-view";

type Params = { params: Promise<Record<string, string>> };

/**
 * Re-executes only the FAIL and BLOCKED results of a run, as a NEW run that
 * points at its parent. The original run is never modified.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const testRunId = (await context.params)["testRunId"]!;
  const [parent] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId)).limit(1);
  if (!parent) throw new AppError("NOT_FOUND", "Test run not found", 404);
  const { projectId } = await requireModuleAccess(parent.moduleId, session);

  const [module] = await db.select({ status: modules.status }).from(modules).where(eq(modules.id, parent.moduleId)).limit(1);
  if (module?.status === "DISABLED") throw new AppError("MODULE_DISABLED", "This module is disabled", 409);

  const [failed] = await db
    .select({ total: count() })
    .from(testRunResults)
    .where(and(eq(testRunResults.testRunId, parent.id), inArray(testRunResults.status, ["FAIL", "BLOCKED"])));
  if (!failed || failed.total === 0) throw new AppError("NOTHING_TO_RERUN", "This run has no failed or blocked results", 409);

  const newRunId = await enqueueTestRun({
    moduleId: parent.moduleId,
    projectId,
    triggeredBy: session.userId,
    parentRunId: parent.id,
    options: {
      browser: parent.browser as "chromium" | "firefox" | "webkit",
      workers: parent.workers,
      retries: parent.retries,
      failFast: parent.failFast,
      environmentId: parent.environmentId,
    },
  });
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, newRunId)).limit(1);
  return created({ testRun: run ? presentRun(run, parent) : null, rerunCount: failed.total });
});
