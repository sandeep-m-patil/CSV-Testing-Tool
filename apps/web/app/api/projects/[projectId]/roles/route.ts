import { asc, count, eq } from "drizzle-orm";
import { credentials, projectRoles } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ProjectRoleInputSchema, type ProjectRole } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rethrowDuplicate } from "@/lib/credentials";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const [roles, usage] = await Promise.all([
    db.select().from(projectRoles).where(eq(projectRoles.projectId, projectId)).orderBy(asc(projectRoles.name)),
    db
      .select({ role: credentials.role, total: count() })
      .from(credentials)
      .where(eq(credentials.projectId, projectId))
      .groupBy(credentials.role),
  ]);
  const counts = new Map(usage.map((row) => [row.role, row.total]));
  const result: ProjectRole[] = roles.map((role) => ({
    id: role.id,
    projectId: role.projectId,
    name: role.name,
    description: role.description,
    credentialCount: counts.get(role.name) ?? 0,
  }));
  return ok({ roles: result });
});

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const projectId = (await context.params)["projectId"]!;
  await requireProjectAccess(projectId, session);

  const input = ProjectRoleInputSchema.parse(await parseBody(request));
  const [role] = await db
    .insert(projectRoles)
    .values({ projectId, name: input.name, description: input.description ?? null })
    .returning()
    .catch(rethrowDuplicate("A role with this name"));
  if (!role) throw new AppError("CREATE_FAILED", "Could not save role", 500);
  return created({ role: { ...role, credentialCount: 0 } });
});
