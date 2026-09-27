import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  projects,
  credentials,
  discoveredActions,
  discoveredElements,
  discoveredPages,
  discoveryArtifacts,
  discoverySessions,
  modules,
  stateTransitions,
  testCases,
  testRunResults,
  testRuns,
  workflows,
} from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  const { projectId } = await requireModuleAccess(moduleId, session);

  const [module, project, latestSession] = await Promise.all([
    db.select().from(modules).where(eq(modules.id, moduleId)).limit(1),
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(discoverySessions).where(eq(discoverySessions.moduleId, moduleId)).orderBy(desc(discoverySessions.createdAt)).limit(1),
  ]);

  if (!module[0] || !project[0]) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }

  const [pageCount, formCount, elementCount, actionCount, transitionCount, workflowCount, testCaseCount, artifactCount, roleRows] =
    await Promise.all([
      db.select({ value: count() }).from(discoveredPages).where(eq(discoveredPages.moduleId, moduleId)),
      db.select({ value: count() }).from(discoveredPages).where(and(eq(discoveredPages.moduleId, moduleId), eq(discoveredPages.pageType, "form"))),
      db.select({ value: count() }).from(discoveredElements).where(eq(discoveredElements.moduleId, moduleId)),
      db.select({ value: count() }).from(discoveredActions).where(eq(discoveredActions.moduleId, moduleId)),
      db.select({ value: count() }).from(stateTransitions).where(eq(stateTransitions.moduleId, moduleId)),
      db.select({ value: count() }).from(workflows).where(eq(workflows.moduleId, moduleId)),
      db.select({ value: count() }).from(testCases).where(eq(testCases.moduleId, moduleId)),
      db.select({ value: count() }).from(discoveryArtifacts).where(eq(discoveryArtifacts.moduleId, moduleId)),
      db.select({ role: credentials.role }).from(credentials).where(eq(credentials.moduleId, moduleId)),
    ]);

  const roles = [...new Set(roleRows.map((row) => row.role))];
  const latest = latestSession[0] ?? null;

  const runRows = await db
    .select({
      id: testRuns.id,
      status: testRuns.status,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      totalCases: testRuns.totalCases,
      passedCases: testRuns.passedCases,
      failedCases: testRuns.failedCases,
      skippedCases: testRuns.skippedCases,
      error: testRuns.error,
    })
    .from(testRuns)
    .where(eq(testRuns.moduleId, moduleId))
    .orderBy(desc(testRuns.createdAt));

  const runIds = runRows.map((run) => run.id);
  const tallyRows = runIds.length
    ? await db
        .select({
          testRunId: testRunResults.testRunId,
          status: testRunResults.status,
          total: count(),
          screenshots: sql<number>`count(${testRunResults.screenshotKey})`,
        })
        .from(testRunResults)
        .where(inArray(testRunResults.testRunId, runIds))
        .groupBy(testRunResults.testRunId, testRunResults.status)
    : [];

  const executedCaseIds = runIds.length
    ? (
        await db
          .selectDistinct({ testCaseId: testRunResults.testCaseId })
          .from(testRunResults)
          .where(inArray(testRunResults.testRunId, runIds))
      ).map((row) => row.testCaseId)
    : [];
  const runs = runRows.map((run) => {
    const tallies = tallyRows.filter((row) => row.testRunId === run.id);
    const byStatus = (status: string) => tallies.find((row) => row.status === status)?.total ?? 0;
    const executed = tallies.reduce((sum, row) => sum + row.total, 0);
    const passed = byStatus("PASS");
    const failed = byStatus("FAIL");
    const blocked = byStatus("BLOCKED");
    const skipped = byStatus("SKIP");
    return {
      ...run,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      executed,
      passed,
      failed,
      blocked,
      skipped,
      screenshots: tallies.reduce((sum, row) => sum + Number(row.screenshots), 0),
      storedTotal: run.totalCases,
      storedPassed: run.passedCases,
      storedFailed: run.failedCases,
      storedSkipped: run.skippedCases,
      /** True when the stored counters disagree with the rows, i.e. aggregation drifted. */
      countersConsistent:
        run.totalCases === executed &&
        run.passedCases === passed &&
        run.failedCases === failed &&
        run.skippedCases === skipped,
    };
  });

  return ok({
    report: {
      project: { name: project[0].name, baseUrl: project[0].baseUrl, environment: project[0].environment },
      module: { id: module[0].id, name: module[0].name, discoveryStatus: module[0].discoveryStatus },
      discovery: latest
        ? {
            sessionId: latest.id,
            status: latest.status,
            startedAt: latest.startedAt?.toISOString() ?? null,
            completedAt: latest.completedAt?.toISOString() ?? null,
            error: latest.error,
          }
        : null,
      counts: {
        pages: pageCount[0]?.value ?? 0,
        forms: formCount[0]?.value ?? 0,
        elements: elementCount[0]?.value ?? 0,
        actions: actionCount[0]?.value ?? 0,
        transitions: transitionCount[0]?.value ?? 0,
        workflows: workflowCount[0]?.value ?? 0,
        testCases: testCaseCount[0]?.value ?? 0,
        artifacts: artifactCount[0]?.value ?? 0,
        roles: roles.length,
      },
      roles,
      testRuns: runs,
      testSummary: runs.reduce(
        (acc, run) => ({
          runs: acc.runs + 1,
          executed: acc.executed + run.executed,
          passed: acc.passed + run.passed,
          failed: acc.failed + run.failed,
          blocked: acc.blocked + run.blocked,
          skipped: acc.skipped + run.skipped,
          screenshots: acc.screenshots + run.screenshots,
        }),
        { runs: 0, executed: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, screenshots: 0 },
      ),
      coverage: {
        testCasesCreated: testCaseCount[0]?.value ?? 0,
        testCasesExecuted: new Set(executedCaseIds).size,
        untestedTestCases: Math.max(0, (testCaseCount[0]?.value ?? 0) - new Set(executedCaseIds).size),
        pagesDiscovered: pageCount[0]?.value ?? 0,
        workflowsDiscovered: workflowCount[0]?.value ?? 0,
      },
    },
  });
});