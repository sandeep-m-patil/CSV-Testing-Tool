import { desc, eq } from "drizzle-orm";
import { applications, modules, projects } from "@repo/db/schema";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const projectId = routeParams['projectId']!;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.createdBy !== session.userId) {
    return ok({ project: null, applications: [], modules: [] });
  }

  const [appRows, moduleRows] = await Promise.all([
    db.select().from(applications).where(eq(applications.projectId, projectId)).orderBy(desc(applications.updatedAt)),
    db
      .select({ module: modules, applicationName: applications.name })
      .from(modules)
      .innerJoin(applications, eq(modules.applicationId, applications.id))
      .where(eq(applications.projectId, projectId))
      .orderBy(desc(modules.updatedAt)),
  ]);

  return ok({
    project,
    applications: appRows,
    modules: moduleRows.map((row) => ({ ...row.module, applicationName: row.applicationName })),
  });
});