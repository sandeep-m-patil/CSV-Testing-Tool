import { and, eq } from "drizzle-orm";
import { moduleCredentials } from "@repo/db/schema";
import { noContent, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

/** Removes the module's reference only; the credential stays on the project for other modules. */
export const DELETE = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const params = await context.params;
  const moduleId = params["moduleId"]!;
  await requireModuleAccess(moduleId, session);
  await db
    .delete(moduleCredentials)
    .where(and(eq(moduleCredentials.moduleId, moduleId), eq(moduleCredentials.credentialId, params["credentialId"]!)));
  return noContent();
});
