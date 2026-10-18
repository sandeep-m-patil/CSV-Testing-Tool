import { and, asc, eq, inArray } from "drizzle-orm";
import { modules, testCases } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { BulkTestCaseStatusInputSchema, CreateTestCaseInputSchema, nextCaseCode } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { rethrowDuplicate } from "@/lib/credentials";
import { assertDatasetInModule, statusAfterEdit } from "@/lib/test-cases/status";
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

  const rows = await db.select().from(testCases).where(eq(testCases.moduleId, moduleId)).orderBy(asc(testCases.createdAt));
  const records = rows.map((row, index) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    code: row.code ?? `TC-${String(index + 1).padStart(4, "0")}`,
    steps: (row.steps as unknown as Array<Record<string, unknown>>) ?? [],
  }));

  return ok({ testCases: records });
});
/**
 * Bulk review: approve or reject many cases in one request. Scoped to the
 * module, so ids from another module are silently ignored rather than updated.
 */
export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const moduleId = (await context.params)["moduleId"]!;
  await requireModuleAccess(moduleId, session);

  const input = BulkTestCaseStatusInputSchema.parse(await parseBody(request));
  const filters = [eq(testCases.moduleId, moduleId)];
  if (input.ids) filters.push(inArray(testCases.id, input.ids));
  if (input.fromStatus) filters.push(eq(testCases.status, input.fromStatus));

  const updated = await db
    .update(testCases)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(...filters))
    .returning({ id: testCases.id });
  return ok({ updated: updated.length });
});


/** A hand-written case. Without a checkable VERIFY step it is created as NEEDS_REVIEW and never runs. */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const moduleId = (await context.params)["moduleId"]!;
  await requireModuleAccess(moduleId, session);
  const input = CreateTestCaseInputSchema.parse(await parseBody(request));
  await assertDatasetInModule(input.datasetId, moduleId);

  const [module] = await db.select({ name: modules.name }).from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!module) throw new AppError("NOT_FOUND", "Module not found", 404);
  const codes = await db.select({ code: testCases.code }).from(testCases).where(eq(testCases.moduleId, moduleId));

  const [testCase] = await db
    .insert(testCases)
    .values({
      ...input,
      moduleId,
      code: input.code ?? nextCaseCode(module.name, codes.map((row) => row.code)),
      source: "manual",
      status: statusAfterEdit(input.steps, "DRAFT"),
      tags: input.tags ?? [],
    })
    .returning()
    .catch(rethrowDuplicate("A test case with this Test ID"));
  return created({ testCase });
});
