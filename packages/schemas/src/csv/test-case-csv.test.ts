import { describe, expect, it } from "vitest";
import { autoMapColumns, buildTestCaseCsv, decodeCsvBytes, parseCsvTable, validateTestCaseRows, type ExportableCase } from "./index";

const MODULE = "Checkout";

function importText(text: string) {
  const table = parseCsvTable(text);
  return validateTestCaseRows(table, autoMapColumns(table.headers), MODULE);
}

const GOOD = [
  "Test ID,Scenario,Steps,Assertions,Priority,Tags",
  'CHK-001,Pays with a saved card,"GOTO https://shop.test/checkout\nCLICK text:Pay now","VERIFY text_present = Thank you",high,"smoke, payments"',
].join("\r\n");

describe("decodeCsvBytes", () => {
  it("strips a UTF-8 BOM", () => {
    expect(decodeCsvBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).text).toBe("A");
  });

  it("reads UTF-16LE from Excel's Unicode export", () => {
    const decoded = decodeCsvBytes(new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xe9, 0x00]));
    expect(decoded).toEqual({ text: "Aé", encoding: "utf-16le" });
  });

  it("falls back to Windows-1252 when the bytes are not valid UTF-8", () => {
    expect(decodeCsvBytes(new Uint8Array([0x43, 0x61, 0x66, 0xe9]))).toEqual({ text: "Café", encoding: "windows-1252" });
  });
});

describe("parseCsvTable", () => {
  it("detects semicolon and tab delimiters", () => {
    expect(parseCsvTable("Test ID;Scenario\nA;B").delimiter).toBe(";");
    expect(parseCsvTable("Test ID\tScenario\nA\tB").rows).toEqual([["A", "B"]]);
  });

  it("keeps quoted commas, escaped quotes and multiline cells, and reports the starting line", () => {
    const table = parseCsvTable('Test ID,Scenario\nA,"one, ""two""\nthree"\nB,four');
    expect(table.rows[0]).toEqual(["A", 'one, "two"\nthree']);
    expect(table.lines).toEqual([2, 4]);
  });

  it("reports an unterminated quote instead of guessing", () => {
    expect(parseCsvTable('Test ID,Scenario\nA,"never closed').errors.length).toBeGreaterThan(0);
  });
});

describe("validateTestCaseRows", () => {
  it("imports a valid row with steps, assertions, priority and tags", () => {
    const [row] = importText(GOOD).rows;
    expect(row?.errors).toEqual([]);
    expect(row?.status).toBe("DRAFT");
    expect(row?.input).toMatchObject({ code: "CHK-001", priority: "HIGH", tags: ["smoke", "payments"] });
    expect(row?.input?.steps.map((step) => step.action)).toEqual(["GOTO", "CLICK", "VERIFY"]);
  });

  it("marks a row without a checkable assertion as needing review", () => {
    expect(importText("Test ID,Scenario,Expected Result\nX-1,Looks right,The page looks right").rows[0]?.status).toBe("NEEDS_REVIEW");
  });

  it("refuses a file missing a required column", () => {
    const result = importText("Scenario\nNo id here");
    expect(result.isValid).toBe(false);
    expect(result.fileErrors.join(" ")).toContain('"Test ID"');
  });

  it("flags both rows of a duplicated Test ID", () => {
    const result = importText("Test ID,Scenario\nA-1,First\na-1,Second");
    expect(result.rows.every((row) => row.errors.some((error) => error.includes("lines 2, 3")))).toBe(true);
  });

  it("reports invalid values against their column and step", () => {
    const [row] = importText("Test ID,Scenario,Priority,Steps\nB-1,Bad,urgent,TAP text:Go").rows;
    expect(row?.errors.join(" ")).toContain("Priority");
    expect(row?.errors.join(" ")).toContain('Unknown action "TAP"');
  });

  it("rejects a row that belongs to a different module", () => {
    expect(importText("Test ID,Module,Scenario\nC-1,Login,Signs in").rows[0]?.errors[0]).toContain('"Login"');
  });
});

describe("buildTestCaseCsv", () => {
  const exported: ExportableCase = {
    code: "CHK-002",
    name: "=HYPERLINK(evil)",
    description: null,
    precondition: null,
    role: "Buyer",
    steps: [
      { order: 1, action: "GOTO", target: "https://shop.test/login", stepType: "action" },
      { order: 2, action: "FILL", target: "role:password", value: "hunter2-secret", stepType: "action" },
      { order: 3, action: "VERIFY", target: "https://shop.test/login", stepType: "verify", expect: { kind: "navigated_away", fromUrl: "https://shop.test/login" } },
    ],
    testData: null,
    expectedResult: null,
    type: "HAPPY_PATH",
    priority: "HIGH",
    severity: "CRITICAL",
    tags: ["auth"],
  };

  it("never writes a stored secret and neutralises formula cells", () => {
    const csv = buildTestCaseCsv([exported], { moduleName: MODULE, secrets: ["hunter2-secret"] });
    expect(csv).not.toContain("hunter2-secret");
    expect(csv).toContain("{{password}}");
    expect(csv).toContain("'=HYPERLINK(evil)");
  });

  it("round-trips through the importer", () => {
    const csv = buildTestCaseCsv([exported], { moduleName: MODULE, secrets: ["hunter2-secret"] });
    const [row] = importText(decodeCsvBytes(new TextEncoder().encode(csv)).text).rows;
    expect(row?.errors).toEqual([]);
    expect(row?.input).toMatchObject({ code: "CHK-002", name: "=HYPERLINK(evil)", severity: "CRITICAL", role: "Buyer" });
    expect(row?.input?.steps.map((step) => step.value)).toEqual([undefined, "{{password}}", undefined]);
  });
});
