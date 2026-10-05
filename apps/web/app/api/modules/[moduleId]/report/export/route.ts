import { desc, eq, inArray } from "drizzle-orm";
import { projects, modules, testCases, testRunResults, testRuns } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  formatCsv,
  formatHtml,
  formatJson,
  formatJUnit,
  type ExportFormat,
  type ReportCaseRow,
  type ReportPayload,
} from "@/lib/report-export";

type Params = { params: Promise<Record<string, string>> };

const FORMATS: ExportFormat[] = ["json", "html", "csv", "junit"];
const FILENAME_STEM = "qa-report";
/** Refuse to build an export larger than this rather than exhausting memory. */
const MAX_RUNS = 50;

function parseFormat(value: string | null): ExportFormat {
  if (value === null) return "json";
  const format = value.toLowerCase();
  if (!FORMATS.includes(format as ExportFormat)) {
    throw new AppError("VALIDATION_ERROR", `Unsupported format "${value}". Use one of: ${FORMATS.join(", ")}`, 400);
  }
  return format as ExportFormat;
}

/**
 * Downloads a module report in the requested format.
 *
 * The aggregate report route stays the JSON source of truth; this only changes
 * representation, so what a user exports is exactly what they see on screen.
 */
export const GET = route(async (request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  const { projectId } = await requireModuleAccess(moduleId, session);

  const format = parseFormat(new URL(request.url).searchParams.get('format'));
  const { payload, cases } = await buildReport(moduleId, projectId);

  const rendered = render(format, payload, cases);
  return new Response(rendered.body, {
    status: 200,
    headers: {
      "content-type": rendered.contentType,
      "content-disposition": `attachment; filename="${FILENAME_STEM}.${format}"`,
      "cache-control": "no-store",
    },
  });
});

function render(format: ExportFormat, payload: ReportPayload, cases: ReportCaseRow[]) {
  switch (format) {
    case "json":
      return formatJson(payload);
    case "html":
      return formatHtml(payload);
    case "csv":
      return formatCsv(payload, cases);
    case "junit":
      return formatJUnit(payload, cases);
  }
}

async function buildReport(
  moduleId: string,
  projectId: string,
): Promise<{ payload: ReportPayload; cases: ReportCaseRow[] }> {
  const [module, project, runs] = await Promise.all([
    db.select().from(modules).where(eq(modules.id, moduleId)).limit(1),
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db
      .select({
        id: testRuns.id,
        status: testRuns.status,
        startedAt: testRuns.startedAt,
        completedAt: testRuns.completedAt,
        totalCases: testRuns.totalCases,
        passedCases: testRuns.passedCases,
        failedCases: testRuns.failedCases,
        skippedCases: testRuns.skippedCases,
        error: testRuns.error,
      })
      .from(testRuns)
      .where(eq(testRuns.moduleId, moduleId))
      .orderBy(desc(testRuns.createdAt))
      .limit(MAX_RUNS),
  ]);

  if (!module[0] || !project[0]) {
    throw new AppError("NOT_FOUND", "Module not found", 404);
  }

  const runIds = runs.map((run) => run.id);
  const results = runIds.length
    ? await db
        .select({
          runId: testRunResults.testRunId,
          runStatus: testRuns.status,
          startedAt: testRuns.startedAt,
          caseId: testRunResults.testCaseId,
          caseCode: testCases.code,
          caseName: testCases.name,
          caseType: testCases.type,
          priority: testCases.priority,
          status: testRunResults.status,
          durationMs: testRunResults.durationMs,
          error: testRunResults.error,
          screenshotKey: testRunResults.screenshotKey,
        })
        .from(testRunResults)
        .innerJoin(testCases, eq(testRunResults.testCaseId, testCases.id))
        .innerJoin(testRuns, eq(testRunResults.testRunId, testRuns.id))
        .where(inArray(testRunResults.testRunId, runIds))
    : [];

  const cases: ReportCaseRow[] = results.map((row) => ({
    runId: row.runId,
    runStatus: row.runStatus,
    startedAt: row.startedAt?.toISOString() ?? null,
    caseCode: row.caseCode,
    caseName: row.caseName,
    caseType: row.caseType,
    priority: row.priority,
    status: row.status,
    durationMs: row.durationMs,
    error: row.error,
    screenshotKey: row.screenshotKey,
  }));

  const runRows = runs.map((run) => {
    const own = cases.filter((row) => row.runId === run.id);
    const byStatus = (status: string) => own.filter((row) => row.status === status).length;
    return {
      ...run,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      executed: own.length,
      passed: byStatus("PASS"),
      failed: byStatus("FAIL"),
      blocked: byStatus("BLOCKED"),
      skipped: byStatus("SKIP"),
      screenshots: own.filter((row) => row.screenshotKey !== null).length,
    };
  });

  const payload: ReportPayload = {
    project: { name: project[0].name, baseUrl: project[0].baseUrl, environment: project[0].environment },
    module: { id: module[0].id, name: module[0].name, discoveryStatus: module[0].discoveryStatus },
    counts: { testRuns: runRows.length, testResults: cases.length },
    testRuns: runRows,
    testSummary: {
      runs: runRows.length,
      executed: cases.length,
      passed: runRows.reduce((sum, run) => sum + run.passed, 0),
      failed: runRows.reduce((sum, run) => sum + run.failed, 0),
      skipped: runRows.reduce((sum, run) => sum + run.skipped, 0),
      screenshots: runRows.reduce((sum, run) => sum + run.screenshots, 0),
    },
    coverage: { testResultsExported: cases.length, runsExported: runRows.length },
  };

  return { payload, cases };
}
