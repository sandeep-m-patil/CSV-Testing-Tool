import { desc, eq } from "drizzle-orm";
import { testDataSets } from "@repo/db/schema";
import { CreateTestDataSetInputSchema } from "@repo/schemas";
import { created, noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);
  const rows = await db.select().from(testDataSets).where(eq(testDataSets.moduleId, moduleId)).orderBy(desc(testDataSets.createdAt));
  return ok({ testDataSets: rows });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const input = CreateTestDataSetInputSchema.parse(await parseBody(request));
  const [dataset] = await db
    .insert(testDataSets)
    .values({ moduleId, name: input.name, dataType: input.data.type, data: input.data })
    .returning();
  return created({ testDataSet: dataset });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const body = (await parseBody(request).catch(() => ({}))) as { testDataSetId?: string };
  if (!body.testDataSetId) {
    return noContent();
  }
  const [existing] = await db.select().from(testDataSets).where(eq(testDataSets.id, body.testDataSetId)).limit(1);
  if (existing && existing.moduleId === moduleId) {
    await db.delete(testDataSets).where(eq(testDataSets.id, body.testDataSetId));
  }
  return noContent();
});