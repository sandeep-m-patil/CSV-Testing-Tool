import { asc, eq } from "drizzle-orm";
import { modules, testCases } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { buildTestCaseCsv, type ExecutableStep } from "@repo/schemas";
import { route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { projectSecrets } from "@/lib/test-cases/project-secrets";

type Params = { params: Promise<Record<string, string>> };

/** The module's test cases as CSV in the import format; stored secrets are replaced by tokens. */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const { moduleId } = await context.params;
  const { projectId } = await requireModuleAccess(moduleId!, session);

  const [module] = await db.select({ name: modules.name }).from(modules).where(eq(modules.id, moduleId!)).limit(1);
  if (!module) throw new AppError("NOT_FOUND", "Module not found", 404);
  const rows = await db.select().from(testCases).where(eq(testCases.moduleId, moduleId!)).orderBy(asc(testCases.createdAt));

  const csv = buildTestCaseCsv(
    rows.map((row) => ({ ...row, steps: (row.steps ?? []) as ExecutableStep[], tags: row.tags ?? [] })),
    { moduleName: module.name, secrets: await projectSecrets(projectId) },
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileSafe(module.name)}-test-cases.csv"`,
      "cache-control": "no-store",
    },
  });
});

function fileSafe(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "module";
}
