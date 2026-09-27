import { asc, eq } from "drizzle-orm";
import { testCases } from "@repo/db/schema";
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

  const rows = await db.select().from(testCases).where(eq(testCases.moduleId, moduleId)).orderBy(asc(testCases.createdAt));
  const records = rows.map((row, index) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    code: `TC-${String(index + 1).padStart(3, "0")}`,
    steps: (row.steps as unknown as Array<Record<string, unknown>>) ?? [],
  }));

  return ok({ testCases: records });
});