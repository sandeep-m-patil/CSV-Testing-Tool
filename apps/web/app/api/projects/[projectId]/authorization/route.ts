import { eq } from "drizzle-orm";
import { environments, projects } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ConfirmTestAuthorizationInputSchema, siteKey, withAuthorizedHost } from "@repo/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

/**
 * POST records the user's confirmation that they may test a site: the project's
 * own base URL, or (with `url`) one of its environments. DELETE revokes every
 * confirmation, which blocks discovery and runs until it is given again.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { projectId } = await context.params;
  await requireProjectAccess(projectId!, session);
  const input = ConfirmTestAuthorizationInputSchema.parse(await parseBody(request).catch(() => ({})));

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId!)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);
  const target = input.url ?? project.baseUrl;
  await assertProjectSite(project.id, project.baseUrl, target);

  const [updated] = await db
    .update(projects)
    .set({
      authorizationConfirmedAt: new Date(),
      authorizationConfirmedBy: session.userId,
      authorizedHosts: withAuthorizedHost(project.authorizedHosts, target),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))
    .returning();
  return ok({ project: updated });
});

export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { projectId } = await context.params;
  await requireProjectAccess(projectId!, session);

  const [updated] = await db
    .update(projects)
    .set({ authorizationConfirmedAt: null, authorizationConfirmedBy: null, authorizedHosts: [], updatedAt: new Date() })
    .where(eq(projects.id, projectId!))
    .returning();
  return ok({ project: updated });
});

/** Only the project's own sites can be confirmed; a free-form URL here would widen what workers may visit. */
async function assertProjectSite(projectId: string, baseUrl: string, target: string): Promise<void> {
  const wanted = siteKey(target);
  const rows = await db.select({ baseUrl: environments.baseUrl }).from(environments).where(eq(environments.projectId, projectId));
  const known = [baseUrl, ...rows.map((row) => row.baseUrl)].map(siteKey);
  if (!wanted || !known.includes(wanted)) {
    throw new AppError("VALIDATION_ERROR", "Only the project's base URL or one of its environments can be authorized", 400);
  }
}
