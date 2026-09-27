import { desc, eq } from "drizzle-orm";
import { modules, testRuns } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { created, ok, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueTestRun } from "@/lib/test-run";

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

  return ok({ runs });
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

  const testRunId = await enqueueTestRun({
    moduleId: moduleId!,
    projectId,
    triggeredBy: session.userId,
  });

  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId)).limit(1);
  return created({ testRun: run });
});
