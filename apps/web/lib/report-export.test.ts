import { describe, expect, it } from "vitest";
import {
  formatCsv,
  formatHtml,
  formatJson,
  formatJUnit,
  type ReportCaseRow,
  type ReportPayload,
} from "./report-export";

const report: ReportPayload = {
  project: { name: "Shop", baseUrl: "https://shop.test", environment: "staging" },
  module: { id: "m1", name: "Checkout & payment", discoveryStatus: "COMPLETED" },
  counts: { pages: 12, forms: 3, testCases: 20 },
  testRuns: [
    {
      id: "run-abcdef123456",
      status: "COMPLETED",
      startedAt: "2026-01-10T00:00:00.000Z",
      completedAt: "2026-01-10T00:05:00.000Z",
      totalCases: 2,
      passedCases: 1,
      failedCases: 1,
      skippedCases: 0,
      error: null,
      executed: 2,
      passed: 1,
      failed: 1,
      blocked: 0,
      skipped: 0,
      screenshots: 1,
    },
  ],
  testSummary: { runs: 1, executed: 2, passed: 1, failed: 1, skipped: 0, screenshots: 1 },
  coverage: { testCasesCreated: 20, testCasesExecuted: 2 },
};

function caseRow(overrides: Partial<ReportCaseRow> = {}): ReportCaseRow {
  return {
    runId: "run-abcdef123456",
    runStatus: "COMPLETED",
    startedAt: "2026-01-10T00:00:00.000Z",
    caseCode: "TC-001",
    caseName: "Checkout total matches cart",
    caseType: "functional",
    priority: "HIGH",
    status: "PASS",
    durationMs: 1200,
    error: null,
    screenshotKey: null,
    ...overrides,
  };
}

describe("formatJson", () => {
  it("round-trips the report", () => {
    const { body, contentType } = formatJson(report);
    expect(contentType).toBe("application/json");
    expect(JSON.parse(body)).toEqual(report);
  });
});

describe("formatCsv", () => {
  it("emits a header and one row per case", () => {
    const { body, contentType } = formatCsv(report, [caseRow(), caseRow({ caseCode: "TC-002" })]);
    expect(contentType).toBe("text/csv");
    expect(body.split("\n")).toHaveLength(3);
    expect(body.split("\n")[0]).toContain("test_case_code");
  });

  it("quotes a value containing a comma or quote", () => {
    const { body } = formatCsv(report, [caseRow({ caseName: 'Total "42", not 43' })]);
    expect(body).toContain('"Total ""42"", not 43"');
  });

  it("emits only the header for a module with no results", () => {
    const { body } = formatCsv(report, []);
    expect(body.trim().split("\n")).toHaveLength(1);
  });
});

describe("formatJUnit", () => {
  it("counts failures and emits one testsuite per run", () => {
    const { body, contentType } = formatJUnit(report, [
      caseRow(),
      caseRow({ caseCode: "TC-002", status: "FAIL", error: "expected 42 <boom>" }),
    ]);
    expect(contentType).toBe("application/xml");
    expect(body).toContain('failures="1"');
    expect(body).toContain("<testsuite");
    expect(body).toContain("<failure");
  });

  it("marks a skip as skipped rather than passed", () => {
    const { body } = formatJUnit(report, [caseRow({ status: "SKIP" })]);
    expect(body).toContain("<skipped/>");
    expect(body).not.toContain("<failure");
  });

  it("escapes angle brackets in failure messages", () => {
    const { body } = formatJUnit(report, [caseRow({ status: "FAIL", error: "a < b && c" })]);
    expect(body).toContain("a &lt; b &amp;&amp; c");
  });

  it("is a valid empty suite when nothing ran", () => {
    const { body } = formatJUnit(report, []);
    expect(body).toContain('tests="0"');
    expect(body).not.toContain("<testsuite ");
  });
});

describe("formatHtml", () => {
  it("includes the module name and run table", () => {
    const { body, contentType } = formatHtml(report);
    expect(contentType).toBe("text/html");
    expect(body).toContain("Checkout &amp; payment");
    expect(body).toContain("<table>");
  });

  it("escapes a module name containing markup", () => {
    const { body } = formatHtml({ ...report, module: { ...report.module, name: "<script>x</script>" } });
    expect(body).not.toContain("<script>x</script>");
    expect(body).toContain("&lt;script&gt;");
  });
});
