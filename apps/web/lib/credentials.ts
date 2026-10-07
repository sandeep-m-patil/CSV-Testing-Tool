import { and, eq, inArray } from "drizzle-orm";
import { credentials, moduleCredentials, projectRoles } from "@repo/db/schema";
import { AppError, credentialCrypto } from "@repo/core";
import type { Credential } from "@repo/schemas";
import { db } from "@/lib/db";

type CredentialRow = typeof credentials.$inferSelect;

/** Shape returned to the client: the secret is never exposed, only whether one is set. */
export type MaskedCredential = Credential;

export function maskCredential(credential: CredentialRow, moduleIds: string[] = []): MaskedCredential {
  return {
    id: credential.id,
    projectId: credential.projectId,
    name: credential.name,
    role: credential.role,
    username: credential.username,
    environmentId: credential.environmentId,
    variables: credential.variables ?? {},
    hasSecret: credential.secretData.length > 0,
    moduleIds,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

/** Masks rows together with the modules that reference each one, in one query. */
export async function maskWithAssignments(rows: CredentialRow[]): Promise<MaskedCredential[]> {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(moduleCredentials)
    .where(inArray(moduleCredentials.credentialId, rows.map((row) => row.id)));
  const byCredential = new Map<string, string[]>();
  for (const link of links) {
    byCredential.set(link.credentialId, [...(byCredential.get(link.credentialId) ?? []), link.moduleId]);
  }
  return rows.map((row) => maskCredential(row, byCredential.get(row.id) ?? []));
}

/**
 * New secrets are scoped to the project, so a credential stays decryptable no
 * matter which module references it. Migrated rows keep their old scope.
 */
export function encryptSecret(scope: string, username: string, password: string): string {
  return credentialCrypto.encryptCredentials(scope, username, password);
}

export async function requireCredentialInProject(credentialId: string, projectId: string): Promise<CredentialRow> {
  const [row] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.id, credentialId), eq(credentials.projectId, projectId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Credential not found", 404);
  return row;
}

/** Roles are configured per project; a credential may name a new one, which is then registered. */
export async function ensureRole(projectId: string, name: string): Promise<void> {
  await db.insert(projectRoles).values({ projectId, name }).onConflictDoNothing();
}

/** Turns a unique-index violation into a readable 409 instead of a 500. */
export function rethrowDuplicate(what: string): (error: unknown) => never {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("duplicate") || message.includes("23505")) {
      throw new AppError("DUPLICATE", `${what} already exists`, 409);
    }
    throw error;
  };
}
