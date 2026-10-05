/**
 * Report export formatting.
 *
 * Pure functions so every format is testable without a database. Each formatter
 * takes the same report object the JSON route returns and produces bytes with
 * the right content type. JUnit exists because CI systems ingest it directly;
 * CSV because spreadsheets are how most people read run results; HTML for
 * sharing; JSON for the API and re-import.
 */

export type ExportFormat = "json" | "html" | "csv" | "junit";

export interface ReportRun {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  skippedCases: number;
  error: string | null;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  screenshots: number;
}

export interface ReportPayload {
  project: { name: string; baseUrl: string; environment: string };
  module: { id: string; name: string; discoveryStatus: string };
  counts: Record<string, number>;
  testRuns: ReportRun[];
  testSummary: Record<string, number>;
  coverage: Record<string, number>;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string): string {
  return escapeXml(value);
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function formatJson(report: ReportPayload): { body: string; contentType: string } {
  return { body: JSON.stringify(report, null, 2), contentType: "application/json" };
}

/** One row per test case across every run, flattened for a spreadsheet. */
export function formatCsv(report: ReportPayload, cases: ReportCaseRow[]): { body: string; contentType: string } {
  const header = [
    "run_id",
    "run_status",
    "started_at",
    "test_case_code",
    "test_case_name",
    "test_case_type",
    "priority",
    "status",
    "duration_ms",
    "error",
    "screenshot_key",
  ];
  const lines = [header.join(",")];
  for (const row of cases) {
    lines.push(
      [
        row.runId,
        row.runStatus,
        row.startedAt ?? "",
        row.caseCode ?? "",
        escapeCsv(row.caseName),
        row.caseType,
        row.priority,
        row.status,
        row.durationMs ?? "",
        row.error ? escapeCsv(row.error) : "",
        row.screenshotKey ?? "",
      ].join(","),
    );
  }
  return { body: lines.join("\n"), contentType: "text/csv" };
}

export interface ReportCaseRow {
  runId: string;
  runStatus: string;
  startedAt: string | null;
  caseCode: string | null;
  caseName: string;
  caseType: string;
  priority: string;
  status: string;
  durationMs: number | null;
  error: string | null;
  screenshotKey: string | null;
}

function junitStatus(status: string): "passed" | "failed" | "skipped" {
  if (status === "PASS") return "passed";
  if (status === "FAIL") return "failed";
  return "skipped";
}

export function formatJUnit(report: ReportPayload, cases: ReportCaseRow[]): { body: string; contentType: string } {
  const failures = cases.filter((row) => junitStatus(row.status) === "failed").length;
  const durationSeconds = (
    cases.reduce((sum, row) => sum + (row.durationMs ?? 0), 0) / 1000
  ).toFixed(3);

  const casesByRun = new Map<string, ReportCaseRow[]>();
  for (const row of cases) {
    const bucket = casesByRun.get(row.runId);
    if (bucket) bucket.push(row);
    else casesByRun.set(row.runId, [row]);
  }

  const suites = [...casesByRun.entries()]
    .map(([runId, rows]) => {
      const runFailures = rows.filter((row) => junitStatus(row.status) === "failed").length;
      const runSkipped = rows.filter((row) => junitStatus(row.status) === "skipped").length;
      const caseXml = rows
        .map((row) => {
          const name = escapeXml(`${row.caseCode ?? "TC"} ${row.caseName}`);
          const detail = row.error ? escapeXml(row.error) : "";
          const time = ((row.durationMs ?? 0) / 1000).toFixed(3);
          if (junitStatus(row.status) === "skipped") {
            return `    <testcase classname="${escapeXml(row.caseType)}" name="${name}" time="${time}"><skipped/></testcase>`;
          }
          if (junitStatus(row.status) === "failed") {
            return `    <testcase classname="${escapeXml(row.caseType)}" name="${name}" time="${time}"><failure message="${escapeXml(row.error ?? "failed")}">${detail}</failure></testcase>`;
          }
          return `    <testcase classname="${escapeXml(row.caseType)}" name="${name}" time="${time}"/>`;
        })
        .join("\n");
      return `  <testsuite name="${escapeXml(runId)}" tests="${rows.length}" failures="${runFailures}" skipped="${runSkipped}" time="${durationSeconds}">\n${caseXml}\n  </testsuite>`;
    })
    .join("\n");

  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuites name="${escapeXml(`${report.project.name} / ${report.module.name}`)}" tests="${cases.length}" failures="${failures}">`,
    suites,
    `</testsuites>`,
  ].join("\n");

  return { body, contentType: "application/xml" };
}

export function formatHtml(report: ReportPayload): { body: string; contentType: string } {
  const summary = report.testSummary;
  const rows = report.testRuns
    .map(
      (run) => `    <tr>
      <td>${escapeHtml(run.id.slice(0, 8))}</td>
      <td>${escapeHtml(run.status)}</td>
      <td>${run.passed}</td>
      <td>${run.failed}</td>
      <td>${run.skipped}</td>
      <td>${run.startedAt ?? "-"}</td>
    </tr>`,
    )
    .join("\n");

  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.project.name)} - ${escapeHtml(report.module.name)}</title>
  </head>
  <body>
    <h1>${escapeHtml(report.project.name)} / ${escapeHtml(report.module.name)}</h1>
    <p>Environment: ${escapeHtml(report.project.environment)} &middot; Target: ${escapeHtml(report.project.baseUrl)}</p>
    <h2>Summary</h2>
    <ul>
      <li>Runs: ${summary["runs"] ?? 0}</li>
      <li>Passed: ${summary["passed"] ?? 0}</li>
      <li>Failed: ${summary["failed"] ?? 0}</li>
      <li>Skipped: ${summary["skipped"] ?? 0}</li>
      <li>Screenshots: ${summary["screenshots"] ?? 0}</li>
    </ul>
    <h2>Runs</h2>
    <table>
      <thead><tr><th>Run</th><th>Status</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Started</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </body>
</html>`;
  return { body, contentType: "text/html" };
}
