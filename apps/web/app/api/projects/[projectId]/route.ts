import { eq } from "drizzle-orm";
import { projects } from "@repo/db/schema";
import { UpdateProjectInputSchema } from "@repo/schemas";
import { ok, parseBody, route, noContent } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const projectId = routeParams['projectId']!;
  await requireProjectAccess(projectId, session);
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return ok({ project: null }, undefined, { status: 404 });
  }
  return ok({ project });
});

export const PATCH = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const projectId = routeParams['projectId']!;
  await requireProjectAccess(projectId, session);

  const input = UpdateProjectInputSchema.parse(await parseBody(request));
  const [project] = await db
    .update(projects)
    .set({
      name: input.name,
      description: input.description ?? null,
      baseUrl: input.baseUrl,
      environment: input.environment,
      productionConfirmed: input.productionConfirmed,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return ok({ project });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
const projectId = routeParams['projectId']!;
  await requireProjectAccess(projectId, session);

  await db.delete(projects).where(eq(projects.id, projectId));
  return noContent();
});