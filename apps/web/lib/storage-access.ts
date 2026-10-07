import { AppError } from "@repo/core";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { moduleIdOfKey } from "@/lib/evidence-key";

/**
 * A key is served only to a signed-in user who owns that module's project.
 * Anything not shaped like evidence is treated as absent, not forbidden, so the
 * route does not reveal which keys exist.
 */
export async function authorizeStorageKey(key: string): Promise<void> {
  const session = await requireSession();
  const moduleId = moduleIdOfKey(key);
  if (!moduleId) throw new AppError("NOT_FOUND", "Artifact not found", 404);
  await requireModuleAccess(moduleId, session);
}
