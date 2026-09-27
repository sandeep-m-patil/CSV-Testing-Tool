import { asc, desc, eq } from "drizzle-orm";
import {
  projects,
  discoveryArtifacts,
  discoveryLogs,
  discoverySessions,
  discoveredActions,
  modules,
  discoveredPages,
} from "@repo/db/schema";
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
  const { projectId } = await requireModuleAccess(moduleId, session);

  const [module, project, sessionRows] = await Promise.all([
    db.select().from(modules).where(eq(modules.id, moduleId)).limit(1),
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.moduleId, moduleId))
      .orderBy(desc(discoverySessions.createdAt))
      .limit(10),
  ]);

  const latest = sessionRows[0] ?? null;
  if (!latest) {
    // The module exists but has never been crawled. This is a normal state, not a
    // missing resource, so return an empty payload the page can render instead of
    // a 404 that the poller would surface as a console error.
    return ok({
      session: null,
      module: module?.[0] ?? null,
      project: project?.[0] ?? null,
      logs: [],
      artifacts: [],
      pages: [],
      actions: [],
      history: [],
    });
  }

  const [logs, artifacts, pages, actions] = await Promise.all([
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
    db
      .select()
      .from(discoveredActions)
      .where(eq(discoveredActions.discoverySessionId, latest.id))
      .orderBy(asc(discoveredActions.createdAt)),
  ]);

  return ok({
    session: latest,
    module: module?.[0] ?? null,
    project: project?.[0] ?? null,
    logs,
    artifacts,
    pages,
    actions,
    history: sessionRows,
  });
});