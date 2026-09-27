import { asc, eq } from "drizzle-orm";
import { workflows } from "@repo/db/schema";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

type Params = { params: Promise<Record<string, string>> };

export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const rows = await db.select().from(workflows).where(eq(workflows.moduleId, moduleId)).orderBy(asc(workflows.createdAt));
  return ok({ workflows: rows });
});