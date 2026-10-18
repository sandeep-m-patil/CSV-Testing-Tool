import Papa from "papaparse";
import type { ExecutableStep } from "../executable-step";
import { formatStepDsl } from "../step-dsl";
import { TEST_CASE_COLUMNS, TEST_CASE_FIELDS } from "./test-case-columns";

/**
 * Test cases to CSV in the interchange format the importer reads back.
 *
 * Two protections: a cell that a spreadsheet would run as a formula
 * (= + - @) is prefixed with an apostrophe, which the importer strips; and any
 * stored credential secret is replaced by its `{{password}}` token, so an
 * export can never carry a plaintext password even if one was typed into a step.
 */

export interface ExportableCase {
  code: string | null;
  name: string;
  description: string | null;
  precondition: string | null;
  role: string | null;
  steps: ExecutableStep[];
  testData: string | null;
  expectedResult: string | null;
  type: string;
  priority: string;
  severity: string | null;
  tags: string[];
}

const PASSWORD_TOKEN = "{{password}}";
const FORMULA_START = /^[=+\-@\t\r]/;
/** Excel opens a BOM-prefixed file as UTF-8 instead of the system code page. */
const UTF8_BOM = "﻿";
const MIN_SECRET_LENGTH = 3;

export function buildTestCaseCsv(cases: readonly ExportableCase[], options: { moduleName: string; secrets?: readonly string[] }): string {
  const scrub = secretScrubber(options.secrets ?? []);
  const header = TEST_CASE_FIELDS.map((field) => TEST_CASE_COLUMNS[field].header);
  const rows = cases.map((testCase) => rowFor(testCase, options.moduleName).map((cell) => guardFormula(scrub(cell))));
  return UTF8_BOM + Papa.unparse([header, ...rows], { newline: "\r\n" });
}

function rowFor(testCase: ExportableCase, moduleName: string): string[] {
  // Only the trailing checks go to Assertions: a VERIFY between two actions
  // stays in Steps, so re-importing keeps every step in its original order.
  const lastAction = lastActionIndex(testCase.steps);
  const actions = testCase.steps.slice(0, lastAction + 1);
  const checks = testCase.steps.slice(lastAction + 1);
  const byField: Record<(typeof TEST_CASE_FIELDS)[number], string> = {
    code: testCase.code ?? "",
    module: moduleName,
    name: testCase.name,
    description: testCase.description ?? "",
    precondition: testCase.precondition ?? "",
    role: testCase.role ?? "",
    steps: formatStepDsl(actions),
    assertions: formatStepDsl(checks),
    testData: testCase.testData ?? "",
    expectedResult: testCase.expectedResult ?? "",
    type: testCase.type,
    priority: testCase.priority,
    severity: testCase.severity ?? "",
    tags: testCase.tags.join(", "),
  };
  return TEST_CASE_FIELDS.map((field) => byField[field]);
}

function lastActionIndex(steps: readonly ExecutableStep[]): number {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.action !== "VERIFY") return index;
  }
  return -1;
}

function guardFormula(cell: string): string {
  return FORMULA_START.test(cell) ? `'${cell}` : cell;
}

function secretScrubber(secrets: readonly string[]): (cell: string) => string {
  const usable = [...new Set(secrets.filter((secret) => secret.length >= MIN_SECRET_LENGTH))].sort((a, b) => b.length - a.length);
  return (cell) => usable.reduce((text, secret) => text.split(secret).join(PASSWORD_TOKEN), cell);
}
