import { and, eq, ne } from "drizzle-orm";
import { environments } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { UpdateEnvironmentInputSchema } from "@repo/schemas";
import { noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rethrowDuplicate } from "@/lib/credentials";
import { assertSafeEnvironmentUrl, toEnvironment } from "@/lib/environments";

type Params = { params: Promise<Record<string, string>> };

async function loadEnvironment(request: Request, context: Params) {
  assertSameOrigin(request);
  const session = await requireSession();
  const params = await context.params;
  const projectId = params["projectId"]!;
  await requireProjectAccess(projectId, session);
  const [row] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, params["environmentId"]!), eq(environments.projectId, projectId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Environment not found", 404);
  return { projectId, row };
}

export const PATCH = route(async (request, context: Params) => {
  const { projectId, row } = await loadEnvironment(request, context);
  const input = UpdateEnvironmentInputSchema.parse(await parseBody(request));
  if (input.baseUrl) assertSafeEnvironmentUrl(input.baseUrl);

  const updated = await db
    .transaction(async (tx) => {
      if (input.isDefault) {
        await tx.update(environments).set({ isDefault: false }).where(and(eq(environments.projectId, projectId), ne(environments.id, row.id)));
      }
      const [next] = await tx
        .update(environments)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(environments.id, row.id))
        .returning();
      return next;
    })
    .catch(rethrowDuplicate("An environment with this name"));
  return ok({ environment: toEnvironment(updated!) });
});

/** Runs and credentials pointing at it keep their history; their reference becomes null. */
export const DELETE = route(async (request, context: Params) => {
  const { row } = await loadEnvironment(request, context);
  await db.delete(environments).where(eq(environments.id, row.id));
  return noContent();
});
