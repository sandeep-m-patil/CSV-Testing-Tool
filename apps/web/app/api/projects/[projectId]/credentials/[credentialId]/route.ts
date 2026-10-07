import { eq } from "drizzle-orm";
import { credentials } from "@repo/db/schema";
import { credentialCrypto } from "@repo/core";
import { UpdateCredentialInputSchema } from "@repo/schemas";
import { noContent, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireProjectAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { encryptSecret, ensureRole, maskWithAssignments, requireCredentialInProject, rethrowDuplicate } from "@/lib/credentials";

type Params = { params: Promise<Record<string, string>> };

async function authorize(request: Request | null, context: Params) {
  if (request) assertSameOrigin(request);
  const session = await requireSession();
  const params = await context.params;
  const projectId = params["projectId"]!;
  await requireProjectAccess(projectId, session);
  return { projectId, existing: await requireCredentialInProject(params["credentialId"]!, projectId) };
}

/**
 * Updates a credential in place, so every module referencing it picks up the
 * change. A new password, or a new username with the stored password, is
 * re-encrypted under the row's own scope.
 */
export const PATCH = route(async (request, context: Params) => {
  const { projectId, existing } = await authorize(request, context);
  const input = UpdateCredentialInputSchema.parse(await parseBody(request));

  const set: Partial<typeof credentials.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.role !== undefined) {
    await ensureRole(projectId, input.role);
    set.role = input.role;
  }
  if (input.environmentId !== undefined) set.environmentId = input.environmentId;
  if (input.variables !== undefined) set.variables = input.variables;
  if (input.username !== undefined) set.username = input.username;
  if (input.password !== undefined || input.username !== undefined) {
    const password = input.password ?? credentialCrypto.decryptCredentials(existing.encryptionScope, existing.secretData)?.password;
    if (password) set.secretData = encryptSecret(existing.encryptionScope, input.username ?? existing.username ?? "", password);
  }

  const [updated] = await db
    .update(credentials)
    .set(set)
    .where(eq(credentials.id, existing.id))
    .returning()
    .catch(rethrowDuplicate("A credential with this name"));
  const [masked] = await maskWithAssignments([updated!]);
  return ok({ credential: masked });
});

/** Removes the credential and, through the cascade, every module reference to it. */
export const DELETE = route(async (request, context: Params) => {
  const { existing } = await authorize(request, context);
  await db.delete(credentials).where(eq(credentials.id, existing.id));
  return noContent();
});
