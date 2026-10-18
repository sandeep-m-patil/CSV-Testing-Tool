import { eq } from "drizzle-orm";
import { credentials } from "@repo/db/schema";
import { credentialCrypto } from "@repo/core";
import { db } from "@/lib/db";

/**
 * Every stored password of the project, decrypted in-process only so exports
 * can scrub them. Never returned to a client or logged.
 */
export async function projectSecrets(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ scope: credentials.encryptionScope, secretData: credentials.secretData })
    .from(credentials)
    .where(eq(credentials.projectId, projectId));
  return rows
    .map((row) => (row.secretData ? credentialCrypto.decryptCredentials(row.scope, row.secretData)?.password : undefined))
    .filter((password): password is string => typeof password === "string" && password.length > 0);
}
