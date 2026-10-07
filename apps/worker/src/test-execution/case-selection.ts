import type { ResolvedCredential } from "../credentials";

/**
 * Which cases a run executes, and as whom.
 *
 * REJECTED cases never run: a reviewer said they are wrong. When the module
 * requires approval, only reviewed cases (APPROVED, READY) run, so AI-generated
 * drafts cannot reach a target until a human has looked at them.
 */

const REVIEWED_STATUSES = new Set(["APPROVED", "READY"]);
const EXCLUDED_STATUSES = new Set(["REJECTED"]);

export function isRunnable(status: string, requireApproval: boolean): boolean {
  if (EXCLUDED_STATUSES.has(status)) return false;
  return !requireApproval || REVIEWED_STATUSES.has(status);
}

/** A credential can sign in only when both halves resolved. */
function isUsable(credential: ResolvedCredential): boolean {
  return Boolean(credential.username && credential.password);
}

/**
 * The credential a case runs with: the one acting as the case's role, else the
 * module's first usable credential. Matching is by role, not by name, because a
 * case is written against what the user may do, not which account does it.
 */
export function credentialFor(list: ResolvedCredential[], role: string | null): ResolvedCredential | undefined {
  const usable = list.filter(isUsable);
  if (role) {
    const match = usable.find((credential) => credential.role === role);
    if (match) return match;
  }
  return usable[0];
}
