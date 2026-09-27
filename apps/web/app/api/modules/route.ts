import { desc, eq } from "drizzle-orm";
import { applications, modules, projects } from "@repo/db/schema";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

export const GET = route(async () => {
  const session = await requireSession();

  const rows = await db
    .select({
      module: modules,
      applicationName: applications.name,
      environment: applications.environment,
      baseUrl: applications.baseUrl,
    })
    .from(modules)
    .innerJoin(applications, eq(modules.applicationId, applications.id))
    .innerJoin(projects, eq(applications.projectId, projects.id))
    .where(eq(projects.createdBy, session.userId))
    .orderBy(desc(modules.updatedAt));

  const visible = rows.map((row) => ({
    ...row.module,
    applicationName: row.applicationName,
    environment: row.environment,
    baseUrl: row.baseUrl,
  }));

  return ok({ modules: visible });
});