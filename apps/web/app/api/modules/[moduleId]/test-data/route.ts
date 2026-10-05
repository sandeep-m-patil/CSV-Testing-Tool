import { desc, eq } from "drizzle-orm";
import { testDataSets } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { CreateTestDataSetInputSchema, normaliseTestDataSetInput } from "@repo/schemas";
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
  const rows = await db
    .select()
    .from(testDataSets)
    .where(eq(testDataSets.moduleId, moduleId))
    .orderBy(desc(testDataSets.createdAt));
  return ok({ testDataSets: rows });
};

/**
 * Stores a dataset.
 *
 * The browser sends raw text — a `key=value` block or pasted CSV — and parsing
 * happens here, so there is exactly one definition of what a dataset row is.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const input = CreateTestDataSetInputSchema.parse(await parseBody(request));
  const data = normaliseTestDataSetInput(input);

  if (data.type === 'csv' && data.rows.length === 0) {
    throw new AppError("VALIDATION_ERROR", "CSV must contain a header row and at least one data row", 400);
  }

  const [dataset] = await db
    .insert(testDataSets)
    .values({ moduleId, name: input.name, dataType: data.type, data })
    .returning();
  return created({ testDataSet: dataset });
});

/**
 * Deletes a dataset.
 *
 * The id may arrive in the query string or the body: the UI uses `?id=`, while
 * older clients posted `{ testDataSetId }`. Both are accepted rather than
 * silently treating the delete as a no-op.
 */
export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const url = new URL(request.url);
  const body = (await parseBody(request).catch(() => ({}))) as { testDataSetId?: string; id?: string };
  const datasetId = url.searchParams.get('id') ?? body.testDataSetId ?? body.id;

  if (!datasetId) return noContent();

  // Scoped by module so an id from another project cannot be deleted here.
  await db
    .delete(testDataSets)
    .where(eq(testDataSets.id, datasetId))
    .where(eq(testDataSets.moduleId, moduleId));

  return noContent();
});
