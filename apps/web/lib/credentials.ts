import type { credentials } from "@repo/db/schema";

type CredentialRow = typeof credentials.$inferSelect;

/** Shape returned to the client: the secret is never exposed, only whether one is set. */
export type MaskedCredential = {
  id: string;
  moduleId: string;
  role: string;
  /** Nullable in the schema: a login may be identified by a field other than a username. */
  username: string | null;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export function maskCredential(credential: CredentialRow): MaskedCredential {
  return {
    id: credential.id,
    moduleId: credential.moduleId,
    role: credential.role,
    username: credential.username,
    hasSecret: credential.secretData.length > 0,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}
