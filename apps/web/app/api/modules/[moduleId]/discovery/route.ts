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
import { evidenceUrl } from "@/lib/evidence-key";

type Params = { params: Promise<Record<string, string>> };

const HISTORY_LIMIT = 50;

/**
 * One discovery session (`?session=<id>`, default the latest) with its logs,
 * evidence and pages, plus the module's run history. Polled while it runs.
 */
export const GET = route(async (request, context: Params) => {
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
      .limit(HISTORY_LIMIT),
  ]);

  // A requested id is honoured only when it belongs to this module.
  const requestedId = new URL(request.url).searchParams.get("session");
  const latest = sessionRows.find((row) => row.id === requestedId) ?? sessionRows[0] ?? null;
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
    // Built from the key at read time: a URL stored at capture time would point
    // at whichever storage backend was configured back then.
    artifacts: artifacts.map((artifact) => ({ ...artifact, url: evidenceUrl(artifact.storageKey) })),
    pages,
    actions,
    history: sessionRows,
  });
});