import { eq } from "drizzle-orm";
import { workflows } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { UpdateWorkflowInputSchema } from "@repo/schemas";
import { ok, parseBody, route } from "@/lib/api";
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
const workflowId = routeParams['workflowId']!;
  await requireModuleAccess(moduleId, session);

  const [existing] = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);
  if (!existing || existing.moduleId !== moduleId) {
    throw new AppError("NOT_FOUND", "Workflow not found", 404);
  }

  const input = UpdateWorkflowInputSchema.parse(await parseBody(request));
  const [workflow] = await db
    .update(workflows)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.preconditions !== undefined ? { preconditions: input.preconditions } : {}),
      ...(input.steps !== undefined ? { steps: input.steps } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId))
    .returning();

  return ok({ workflow });
});