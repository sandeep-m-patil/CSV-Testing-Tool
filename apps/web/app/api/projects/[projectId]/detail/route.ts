import { desc, eq } from "drizzle-orm";
import { modules, projects } from "@repo/db/schema";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
  const projectId = routeParams["projectId"]!;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.createdBy !== session.userId) {
    return ok({ project: null, modules: [] });
  }

  const moduleRows = await db
    .select()
    .from(modules)
    .where(eq(modules.projectId, projectId))
    .orderBy(desc(modules.updatedAt));

  return ok({ project, modules: moduleRows });
});
