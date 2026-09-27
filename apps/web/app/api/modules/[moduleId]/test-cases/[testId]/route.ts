import { eq } from "drizzle-orm";
import { testCases } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { UpdateTestCaseInputSchema } from "@repo/schemas";
import { noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

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
  const [testCase] = await db
    .update(testCases)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.precondition !== undefined ? { precondition: input.precondition } : {}),
      ...(input.steps !== undefined ? { steps: input.steps } : {}),
      updatedAt: new Date(),
    })
    .where(eq(testCases.id, testId))
    .returning();

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