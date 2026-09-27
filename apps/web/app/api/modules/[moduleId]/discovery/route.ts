import { asc, desc, eq } from "drizzle-orm";
import { applications, discoveryArtifacts, discoveryLogs, discoverySessions, modules, discoveredPages } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

/**
 * Latest discovery session for a module + live logs + evidence artifacts.
 * Polled by the frontend while discovery runs.
 */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  const { applicationId } = await requireModuleAccess(moduleId, session);

  const [module, application, sessionRows] = await Promise.all([
    db.select().from(modules).where(eq(modules.id, moduleId)).limit(1),
    db.select().from(applications).where(eq(applications.id, applicationId)).limit(1),
    db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.moduleId, moduleId))
      .orderBy(desc(discoverySessions.createdAt))
      .limit(10),
  ]);

  const latest = sessionRows[0] ?? null;
  if (!latest) {
    throw new AppError("NOT_FOUND", "No discovery session has been started for this module", 404);
  }

  const [logs, artifacts, pages] = await Promise.all([
    db
      .select()
      .from(discoveryLogs)
      .where(eq(discoveryLogs.discoverySessionId, latest.id))
      .orderBy(asc(discoveryLogs.createdAt))
      .limit(500),
    db
      .select()
      .from(discoveryArtifacts)
      .where(eq(discoveryArtifacts.discoverySessionId, latest.id))
      .orderBy(asc(discoveryArtifacts.createdAt))
      .limit(200),
    db
      .select()
      .from(discoveredPages)
      .where(eq(discoveredPages.discoverySessionId, latest.id))
      .orderBy(asc(discoveredPages.order)),
  ]);

  return ok({
    session: latest,
    module: module?.[0] ?? null,
    application: application?.[0] ?? null,
    logs,
    artifacts,
    pages,
    history: sessionRows,
  });
});