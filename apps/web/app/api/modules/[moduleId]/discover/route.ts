import { eq } from "drizzle-orm";
import { applications, discoverySessions, modules } from "@repo/db/schema";
import { AppError, createDiscoveryQueue, DISCOVERY_JOB_NAME } from "@repo/core";
import { DiscoverModuleInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  const { applicationId, projectId } = await requireModuleAccess(moduleId, session);

  const input = DiscoverModuleInputSchema.parse(await parseBody(request).catch(() => ({})));

  const [module] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
  if (!module) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!application) {
    throw new AppError("NOT_FOUND", "Application not found", 404);
  }
  if (application.environment === "production") {
    throw new AppError("PRODUCTION_BLOCKED", "Autonomous discovery is disabled for production environments.", 403);
  }
  if (!process.env.REDIS_URL) {
    throw new AppError("REDIS_UNCONFIGURED", "Redis is not configured. Start it with `docker compose up redis` and set REDIS_URL.", 503);
  }

  const [sessionRow] = await db
    .insert(discoverySessions)
    .values({ moduleId, status: "QUEUED" })
    .returning();
  if (!sessionRow) {
    throw new AppError("DISCOVERY_FAILED", "Could not create discovery session", 500);
  }

  const queue = createDiscoveryQueue(process.env.REDIS_URL);
  await queue.add(DISCOVERY_JOB_NAME, {
    discoverySessionId: sessionRow.id,
    moduleId,
    applicationId,
    projectId,
    role: input.role,
  });
  await queue.close();

  await db
    .update(modules)
    .set({ discoveryStatus: "DISCOVERING", status: "ACTIVE", updatedAt: new Date() })
    .where(eq(modules.id, moduleId));
  await db
    .update(applications)
    .set({ status: application.status === "ERROR" || application.status === "NOT_DISCOVERED" ? "DISCOVERING" : application.status, updatedAt: new Date() })
    .where(eq(applications.id, applicationId));

  return created({ discoverySession: sessionRow });
});