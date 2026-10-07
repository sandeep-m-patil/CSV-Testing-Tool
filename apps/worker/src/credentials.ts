import { asc, eq } from "drizzle-orm";
import { CredentialCrypto, createChildLogger } from "@repo/core";
import type { Db } from "@repo/db";
import { credentials, moduleCredentials } from "@repo/db/schema";

/**
 * Secure credential resolution, the only place a secret is decrypted:
 *
 *   module → credential reference → project credential → decrypted in-process
 *
 * Callers receive plaintext only to type it into a browser or to mask it out of
 * evidence. It is never logged, stored, or sent to an AI provider.
 */

export interface ResolvedCredential {
  id: string;
  name: string;
  role: string;
  /** Nullable: a login may be keyed on a field other than a username. */
  username: string | null;
  /** Null when the stored secret is a placeholder or cannot be decrypted. */
  password: string | null;
  environmentId: string | null;
  /** Non-secret `{{name}}` values for test steps. */
  variables: Record<string, string>;
}

type CredentialRow = typeof credentials.$inferSelect;

const crypto = new CredentialCrypto();
const log = createChildLogger({ scope: "credentials" });

/** Credentials a module references, in a stable order (by name). */
export async function loadModuleCredentials(db: Db, moduleId: string): Promise<ResolvedCredential[]> {
  const rows = await db
    .select({ credential: credentials })
    .from(moduleCredentials)
    .innerJoin(credentials, eq(credentials.id, moduleCredentials.credentialId))
    .where(eq(moduleCredentials.moduleId, moduleId))
    .orderBy(asc(credentials.name));
  return rows.map((row) => resolveCredential(row.credential));
}

export function resolveCredential(row: CredentialRow): ResolvedCredential {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    username: row.username,
    password: decryptPassword(row),
    environmentId: row.environmentId,
    variables: row.variables ?? {},
  };
}

/**
 * Keeps credentials usable in this environment: one pinned to it, or one not
 * pinned to any. Without a target environment every credential applies.
 */
export function forEnvironment(list: ResolvedCredential[], environmentId: string | null): ResolvedCredential[] {
  if (!environmentId) return list;
  return list.filter((credential) => credential.environmentId === null || credential.environmentId === environmentId);
}

/** Every value that must be masked out of screenshots and scrubbed from AI/Jev traffic. */
export function secretsOf(list: ResolvedCredential[]): string[] {
  return list.flatMap((credential) => [credential.username, credential.password]).filter((value): value is string => Boolean(value));
}

function decryptPassword(row: CredentialRow): string | null {
  if (isPlaceholderSecret(row.secretData)) return null;
  try {
    return crypto.decryptCredentials(row.encryptionScope, row.secretData)?.password ?? null;
  } catch (error) {
    // The role is safe to log; the payload and any partial plaintext are not.
    log.warn({ credentialId: row.id, role: row.role, error }, "credential decryption failed");
    return null;
  }
}

/** Seeded rows hold a JSON placeholder instead of ciphertext ("iv:tag:data"). */
function isPlaceholderSecret(secretData: string): boolean {
  try {
    const parsed: unknown = JSON.parse(secretData);
    return typeof parsed === "object" && parsed !== null && "placeholder" in parsed;
  } catch {
    return false;
  }
}
