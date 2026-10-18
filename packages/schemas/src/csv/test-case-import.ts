import { CreateTestCaseInputSchema, hasCheckableOutcome, type CreateTestCaseInput } from "../test-case";
import { parseStepDsl } from "../step-dsl";
import type { CsvTable } from "./decode";
import { missingRequiredColumns, TEST_CASE_COLUMNS, TEST_CASE_FIELDS, type ColumnMapping, type TestCaseField } from "./test-case-columns";

/**
 * Row-level validation of a mapped test-case CSV. Every problem is reported
 * against its row and column so the wizard can show it in place; a file with
 * any error imports nothing, so a half-applied import never happens.
 */

export interface ImportRow {
  /** 1-based line in the file where the row starts. */
  line: number;
  /** Raw Test ID and Scenario cells, so a row that failed validation can still be recognised. */
  code: string;
  name: string;
  input: CreateTestCaseInput | null;
  /** Derived status: NEEDS_REVIEW when the row has no checkable expected outcome. */
  status: "DRAFT" | "NEEDS_REVIEW";
  errors: string[];
}

export interface ImportValidation {
  rows: ImportRow[];
  /** Problems that are not about one row (missing columns, file errors). */
  fileErrors: string[];
  isValid: boolean;
}

const LIST_SEPARATOR = /[,;]/;
/** Export prefixes these so spreadsheets do not run a cell as a formula; import strips it. */
const FORMULA_GUARD = /^'(?=[=+\-@])/;

export function validateTestCaseRows(table: CsvTable, mapping: ColumnMapping, moduleName: string): ImportValidation {
  const missing = missingRequiredColumns(mapping);
  const fileErrors = [...table.errors, ...missing.map((field) => `Map a column to "${TEST_CASE_COLUMNS[field].header}"; it is required.`)];
  const rows = table.rows.map((cells, index) => validateRow(cellReader(cells, mapping), { line: table.lines[index] ?? index + 2, moduleName }));
  flagDuplicateCodes(rows);
  if (table.rows.length === 0) fileErrors.push("The file has a header row but no test cases.");
  const isValid = fileErrors.length === 0 && rows.every((row) => row.errors.length === 0);
  return { rows, fileErrors, isValid };
}

type CellReader = (field: TestCaseField) => string;

function cellReader(cells: readonly string[], mapping: ColumnMapping): CellReader {
  return (field) => {
    const index = mapping[field];
    return index === null ? "" : (cells[index] ?? "").replace(FORMULA_GUARD, "").trim();
  };
}

function validateRow(cell: CellReader, context: { line: number; moduleName: string }): ImportRow {
  const errors: string[] = [];
  const moduleCell = cell("module");
  if (moduleCell && moduleCell.toLowerCase() !== context.moduleName.toLowerCase()) {
    errors.push(`Module is "${moduleCell}" but you are importing into "${context.moduleName}".`);
  }
  const parsed = parseStepDsl([cell("steps"), cell("assertions")].filter(Boolean).join("\n"));
  errors.push(...parsed.errors.map((error) => `Steps/Assertions step ${error.step}: ${error.message}`));

  const candidate = CreateTestCaseInputSchema.safeParse(rowValues(cell, parsed.steps));
  if (!candidate.success) {
    errors.push(...candidate.error.issues.map((issue) => `${headerFor(String(issue.path[0] ?? ""))}: ${issue.message}`));
  }
  const input = candidate.success ? candidate.data : null;
  const status = input && hasCheckableOutcome(input.steps) ? "DRAFT" : "NEEDS_REVIEW";
  return { line: context.line, code: cell("code"), name: cell("name"), input, status, errors };
}

function rowValues(cell: CellReader, steps: unknown[]): Record<string, unknown> {
  const optional = (field: TestCaseField) => cell(field) || undefined;
  const upper = (field: TestCaseField) => cell(field).toUpperCase().replace(/[\s-]+/g, "_") || undefined;
  return {
    code: cell("code"),
    name: cell("name"),
    description: optional("description") ?? null,
    precondition: optional("precondition") ?? null,
    role: optional("role") ?? null,
    testData: optional("testData") ?? null,
    expectedResult: optional("expectedResult") ?? null,
    type: upper("type"),
    priority: upper("priority"),
    severity: upper("severity") ?? null,
    tags: cell("tags").split(LIST_SEPARATOR).map((tag) => tag.trim()).filter(Boolean),
    steps,
  };
}

function headerFor(field: string): string {
  return (TEST_CASE_FIELDS as readonly string[]).includes(field) ? TEST_CASE_COLUMNS[field as TestCaseField].header : field;
}

/** Two rows with one Test ID would silently overwrite each other; both are flagged. */
function flagDuplicateCodes(rows: ImportRow[]): void {
  const linesByCode = new Map<string, number[]>();
  for (const row of rows) {
    const code = row.input?.code?.toLowerCase();
    if (code) linesByCode.set(code, [...(linesByCode.get(code) ?? []), row.line]);
  }
  for (const row of rows) {
    const lines = linesByCode.get(row.input?.code?.toLowerCase() ?? "") ?? [];
    if (lines.length > 1) row.errors.push(`Test ID "${row.input?.code}" is used on lines ${lines.join(", ")}.`);
  }
}
