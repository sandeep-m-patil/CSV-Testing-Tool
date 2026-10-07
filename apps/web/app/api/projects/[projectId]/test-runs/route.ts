import { and, desc, eq } from "drizzle-orm";
import { modules, testRuns } from "@repo/db/schema";
import { StartTestRunInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueTestRun } from "@/lib/test-run";
import { presentRun } from "@/lib/test-run-view";

type Params = { params: Promise<Record<string, string>> };
const RECENT_RUNS = 50;

/** Recent runs across every module of the project, newest first. */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);
  const runs = await db
    .select({ run: testRuns, moduleName: modules.name })
    .from(testRuns)
    .innerJoin(modules, eq(modules.id, testRuns.moduleId))
    .where(eq(modules.projectId, projectId))
    .orderBy(desc(testRuns.createdAt))
    .limit(RECENT_RUNS);
  return ok({ runs: runs.map((row) => ({ ...presentRun(row.run), moduleName: row.moduleName })) });
});

/**
 * Run All: one new run per enabled module, with the same options. A module that
 * cannot be queued is reported, not allowed to abort the others.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);
  const options = StartTestRunInputSchema.parse(await parseBody(request).catch(() => ({})));

  const enabled = await db.select().from(modules).where(and(eq(modules.projectId, projectId), eq(modules.status, "ACTIVE")));
  const started: Array<{ moduleId: string; moduleName: string; testRunId: string }> = [];
  const failed: Array<{ moduleId: string; moduleName: string; error: string }> = [];
  for (const module of enabled) {
    try {
      const testRunId = await enqueueTestRun({ moduleId: module.id, projectId, triggeredBy: session.userId, options });
      started.push({ moduleId: module.id, moduleName: module.name, testRunId });
    } catch (error) {
      failed.push({ moduleId: module.id, moduleName: module.name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return created({ started, failed });
});
