import { and, asc, eq, inArray } from "drizzle-orm";
import { testCases } from "@repo/db/schema";
import { BulkTestCaseStatusInputSchema } from "@repo/schemas";
import { ok, parseBody, route } from "@/lib/api";
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
