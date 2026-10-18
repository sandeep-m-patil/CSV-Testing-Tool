import { eq } from "drizzle-orm";
import { testCases } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { UpdateTestCaseInputSchema, type ExecutableStep } from "@repo/schemas";
import { noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rethrowDuplicate } from "@/lib/credentials";
import { assertDatasetInModule, statusAfterEdit } from "@/lib/test-cases/status";

type Params = { params: Promise<Record<string, string>> };

export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
const testId = routeParams['testId']!;
  await requireModuleAccess(moduleId, session);

  const [existing] = await db.select().from(testCases).where(eq(testCases.id, testId)).limit(1);
  if (!existing || existing.moduleId !== moduleId) {
    throw new AppError("NOT_FOUND", "Test case not found", 404);
  }

  const input = UpdateTestCaseInputSchema.parse(await parseBody(request));
  await assertDatasetInModule(input.datasetId, moduleId);
  const { status: requested, ...fields } = input;
  const steps = input.steps ?? ((existing.steps ?? []) as ExecutableStep[]);
  const status = input.steps !== undefined || requested !== undefined ? statusAfterEdit(steps, existing.status, requested) : existing.status;

  const [testCase] = await db
    .update(testCases)
    // A content edit makes the case human-authored, so re-discovery leaves it alone;
    // approving or rejecting alone keeps its original provenance.
    .set({ ...fields, status, ...(Object.keys(fields).length > 0 ? { source: "manual" } : {}), updatedAt: new Date() })
    .where(eq(testCases.id, testId))
    .returning()
    .catch(rethrowDuplicate("A test case with this Test ID"));

  return ok({ testCase });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
const testId = routeParams['testId']!;
  await requireModuleAccess(moduleId, session);

  const [existing] = await db.select().from(testCases).where(eq(testCases.id, testId)).limit(1);
  if (existing && existing.moduleId === moduleId) {
    await db.delete(testCases).where(eq(testCases.id, testId));
  }
  return noContent();
});