import { eq } from "drizzle-orm";
import { discoverySessions, modules } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { DiscoverModuleInputSchema } from "@repo/schemas";
import { created, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueDiscovery } from "@/lib/discovery";

type Params = { params: Promise<Record<string, string>> };

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  const { projectId } = await requireModuleAccess(moduleId, session);

  const input = DiscoverModuleInputSchema.parse(await parseBody(request).catch(() => ({})));

  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }
  if (module.status === "DISABLED") {
    throw new AppError("MODULE_DISABLED", "This module is disabled; enable it before it can be discovered", 409);
  }

  const discoverySessionId = await enqueueDiscovery({
    moduleId,
    projectId,
    role: input.role,
  });

  const [sessionRow] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, discoverySessionId));

  return created({ discoverySession: sessionRow });
});
