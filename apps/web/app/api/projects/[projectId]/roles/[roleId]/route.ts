import { and, count, eq, inArray } from "drizzle-orm";
import { credentials, modules, projectRoles, testCases } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ProjectRoleInputSchema } from "@repo/schemas";
import { noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { rethrowDuplicate } from "@/lib/credentials";

type Params = { params: Promise<Record<string, string>> };

async function loadRole(request: Request, context: Params) {
  assertSameOrigin(request);
  const session = await requireSession();
  const params = await context.params;
  const projectId = params["projectId"]!;
  await requireProjectAccess(projectId, session);
  const [role] = await db
    .select()
    .from(projectRoles)
    .where(and(eq(projectRoles.id, params["roleId"]!), eq(projectRoles.projectId, projectId)))
    .limit(1);
  if (!role) throw new AppError("NOT_FOUND", "Role not found", 404);
  return { projectId, role };
}

/**
 * Renames a role everywhere it is referenced by name — credentials and test
 * cases of this project — in one transaction, so no case is left pointing at a
 * role that no longer exists.
 */
export const PATCH = route(async (request, context: Params) => {
  const { projectId, role } = await loadRole(request, context);
  const input = ProjectRoleInputSchema.partial().parse(await parseBody(request));
  const nextName = input.name ?? role.name;

  const updated = await db
    .transaction(async (tx) => {
      const [row] = await tx
        .update(projectRoles)
        .set({ name: nextName, description: input.description === undefined ? role.description : input.description, updatedAt: new Date() })
        .where(eq(projectRoles.id, role.id))
        .returning();
      if (nextName !== role.name) {
        await tx.update(credentials).set({ role: nextName }).where(and(eq(credentials.projectId, projectId), eq(credentials.role, role.name)));
        const moduleIds = tx.select({ id: modules.id }).from(modules).where(eq(modules.projectId, projectId));
        await tx.update(testCases).set({ role: nextName }).where(and(inArray(testCases.moduleId, moduleIds), eq(testCases.role, role.name)));
      }
      return row;
    })
    .catch(rethrowDuplicate("A role with this name"));
  return ok({ role: updated });
});

/** Refuses while credentials still act as this role, rather than orphaning them. */
export const DELETE = route(async (request, context: Params) => {
  const { projectId, role } = await loadRole(request, context);
  const [usage] = await db
    .select({ total: count() })
    .from(credentials)
    .where(and(eq(credentials.projectId, projectId), eq(credentials.role, role.name)));
  if ((usage?.total ?? 0) > 0) {
    throw new AppError("ROLE_IN_USE", `${usage!.total} credential(s) still use this role; reassign them first`, 409);
  }
  await db.delete(projectRoles).where(eq(projectRoles.id, role.id));
  return noContent();
});
