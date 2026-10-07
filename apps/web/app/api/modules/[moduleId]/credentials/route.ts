import { and, asc, eq, inArray } from "drizzle-orm";
import { credentials, moduleCredentials } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ModuleCredentialAssignmentSchema } from "@repo/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { maskWithAssignments } from "@/lib/credentials";

type Params = { params: Promise<Record<string, string>> };

/** The project credentials this module references. Credentials live on the project. */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const moduleId = (await context.params)["moduleId"]!;
  await requireModuleAccess(moduleId, session);
  const rows = await db
    .select({ credential: credentials })
    .from(moduleCredentials)
    .innerJoin(credentials, eq(credentials.id, moduleCredentials.credentialId))
    .where(eq(moduleCredentials.moduleId, moduleId))
    .orderBy(asc(credentials.name));
  return ok({ credentials: await maskWithAssignments(rows.map((row) => row.credential)) });
});

/**
 * Replaces the module's references. Every id must belong to the module's own
 * project, so a module can never borrow another project's login.
 */
export const PUT = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const moduleId = (await context.params)["moduleId"]!;
  const { projectId } = await requireModuleAccess(moduleId, session);
  const { credentialIds } = ModuleCredentialAssignmentSchema.parse(await parseBody(request));
  const unique = [...new Set(credentialIds)];

  if (unique.length > 0) {
    const owned = await db
      .select({ id: credentials.id })
      .from(credentials)
      .where(and(eq(credentials.projectId, projectId), inArray(credentials.id, unique)));
    if (owned.length !== unique.length) throw new AppError("INVALID_CREDENTIAL", "Some credentials do not belong to this project", 400);
  }

  await db.transaction(async (tx) => {
    await tx.delete(moduleCredentials).where(eq(moduleCredentials.moduleId, moduleId));
    if (unique.length > 0) await tx.insert(moduleCredentials).values(unique.map((credentialId) => ({ moduleId, credentialId })));
  });
  return ok({ credentialIds: unique });
});
