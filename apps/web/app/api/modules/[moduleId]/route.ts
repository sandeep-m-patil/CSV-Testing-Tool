import { eq } from "drizzle-orm";
import { credentials, modules, projects, testDataSets, discoverySessions, workflows, testCases } from "@repo/db/schema";
import { UpdateModuleInputSchema } from "@repo/schemas";
import { ok, parseBody, route, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  const { projectId } = await requireModuleAccess(moduleId, session);

  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!module) {
    return ok({ module: null }, undefined, { status: 404 });
  }
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  const [credRows, dataRows, sessionRows] = await Promise.all([
    db.select().from(credentials).where(eq(credentials.moduleId, moduleId)),
    db.select().from(testDataSets).where(eq(testDataSets.moduleId, moduleId)),
    db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.moduleId, moduleId))
      .orderBy(discoverySessions.createdAt),
  ]);
  const lastSession = sessionRows[sessionRows.length - 1] ?? null;

  const masks = credRows.map((credential) => ({
    id: credential.id,
    moduleId: credential.moduleId,
    role: credential.role,
    username: credential.username,
    hasSecret: credential.secretData.length > 0,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  }));

  const dataSets = dataRows.map((dataset) => ({
    id: dataset.id,
    moduleId: dataset.moduleId,
    name: dataset.name,
    dataType: dataset.dataType,
    data: dataset.data,
    createdAt: dataset.createdAt.toISOString(),
    updatedAt: dataset.updatedAt.toISOString(),
  }));

  return ok({
    module,
    project: project ?? null,
    projectId,
    credentials: masks,
    testDataSets: dataSets,
    lastDiscoverySession: lastSession ?? null,
  });
});

export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const input = UpdateModuleInputSchema.parse(await parseBody(request));
  const [module] = await db
    .update(modules)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(modules.id, moduleId))
    .returning();

  return ok({ module });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  await Promise.all([
    db.delete(credentials).where(eq(credentials.moduleId, moduleId)),
    db.delete(testDataSets).where(eq(testDataSets.moduleId, moduleId)),
    db.delete(workflows).where(eq(workflows.moduleId, moduleId)),
    db.delete(testCases).where(eq(testCases.moduleId, moduleId)),
  ]);
  await db.delete(modules).where(eq(modules.id, moduleId));
  return noContent();
});