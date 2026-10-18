import { eq } from "drizzle-orm";
import { modules } from "@repo/db/schema";
import { AppError } from "@repo/core";
import {
  ImportTestCasesInputSchema,
  parseCsvTable,
  TEST_CASE_FIELDS,
  validateTestCaseRows,
  type ColumnMapping,
} from "@repo/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { importTestCases } from "@/lib/test-cases/import";

type Params = { params: Promise<Record<string, string>> };

/** Rows reported back on a rejected import; the wizard shows the same errors before upload. */
const MAX_REPORTED_ROWS = 200;

/**
 * Imports a test-case CSV. The file is validated again here with the same
 * rules the wizard previewed, and a file with any error imports nothing.
 */
export const POST = route(async (request, context: Params) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const { moduleId } = await context.params;
  await requireModuleAccess(moduleId!, session);
  const input = ImportTestCasesInputSchema.parse(await parseBody(request));

  const [module] = await db.select({ name: modules.name }).from(modules).where(eq(modules.id, moduleId!)).limit(1);
  if (!module) throw new AppError("NOT_FOUND", "Module not found", 404);

  const table = parseCsvTable(input.csv);
  const validation = validateTestCaseRows(table, toMapping(input.mapping, table.headers.length), module.name);
  if (!validation.isValid) {
    const rowErrors = validation.rows.filter((row) => row.errors.length > 0).slice(0, MAX_REPORTED_ROWS);
    throw new AppError("CSV_INVALID", "The file has errors; nothing was imported.", 422, {
      fileErrors: validation.fileErrors,
      rowErrors: rowErrors.map((row) => ({ line: row.line, errors: row.errors })),
    });
  }
  return ok({ result: await importTestCases(moduleId!, validation.rows, input.mode) });
});

/** Unknown fields and out-of-range columns are ignored rather than trusted. */
function toMapping(raw: Record<string, number | null>, columnCount: number): ColumnMapping {
  const mapping = {} as ColumnMapping;
  for (const field of TEST_CASE_FIELDS) {
    const index = raw[field];
    mapping[field] = typeof index === "number" && index < columnCount ? index : null;
  }
  return mapping;
}
