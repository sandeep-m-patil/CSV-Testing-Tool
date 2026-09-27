import { desc, eq } from "drizzle-orm";
import { modules, projects } from "@repo/db/schema";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

export const GET = route(async () => {
  const session = await requireSession();

  const rows = await db
    .select({
      module: modules,
      projectName: projects.name,
      environment: projects.environment,
      baseUrl: projects.baseUrl,
    })
    .from(modules)
    .innerJoin(projects, eq(modules.projectId, projects.id))
    .where(eq(projects.createdBy, session.userId))
    .orderBy(desc(modules.updatedAt));

  const visible = rows.map((row) => ({
    ...row.module,
    projectName: row.projectName,
    environment: row.environment,
    baseUrl: row.baseUrl,
  }));

  return ok({ modules: visible });
});
