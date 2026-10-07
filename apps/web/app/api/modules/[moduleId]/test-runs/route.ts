import { desc, eq } from "drizzle-orm";
import { modules, testRuns } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { StartTestRunInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueTestRun } from "@/lib/test-run";
import { presentRun } from "@/lib/test-run-view";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const { moduleId } = await context.params;
  await requireModuleAccess(moduleId!, session);

  const runs = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.moduleId, moduleId!))
    .orderBy(desc(testRuns.createdAt))
    .limit(20);

  return ok({ runs: runs.map((run) => presentRun(run)) });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { moduleId } = await context.params;
  const { projectId } = await requireModuleAccess(moduleId!, session);

  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId!)).limit(1);
  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }
  if (module.status === "DISABLED") {
    throw new AppError("MODULE_DISABLED", "This module is disabled; enable it before it can be run", 409);
  }

  // Options are optional: an empty body runs with defaults (chromium, 1 worker, no retries).
  const options = StartTestRunInputSchema.parse(await parseBody(request).catch(() => ({})));
  const testRunId = await enqueueTestRun({ moduleId: moduleId!, projectId, triggeredBy: session.userId, options });

  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId)).limit(1);
  return created({ testRun: run ? presentRun(run) : null });
});
