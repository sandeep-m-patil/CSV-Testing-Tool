import { and, count, desc, eq } from "drizzle-orm";
import {
  applications,
  credentials,
  discoveredActions,
  discoveredElements,
  discoveredPages,
  discoveryArtifacts,
  discoverySessions,
  modules,
  stateTransitions,
  testCases,
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
  const { applicationId } = await requireModuleAccess(moduleId, session);

  const [module, application, latestSession] = await Promise.all([
    db.select().from(modules).where(eq(modules.id, moduleId)).limit(1),
    db.select().from(applications).where(eq(applications.id, applicationId)).limit(1),
    db.select().from(discoverySessions).where(eq(discoverySessions.moduleId, moduleId)).orderBy(desc(discoverySessions.createdAt)).limit(1),
  ]);

  if (!module[0] || !application[0]) {
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

  return ok({
    report: {
      application: { name: application[0].name, baseUrl: application[0].baseUrl, environment: application[0].environment },
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
        actions: actionCount[0]?.value ?? 0,
        transitions: transitionCount[0]?.value ?? 0,
        workflows: workflowCount[0]?.value ?? 0,
        testCases: testCaseCount[0]?.value ?? 0,
        artifacts: artifactCount[0]?.value ?? 0,
        roles: roles.length,
      },
      roles,
    },
  });
});