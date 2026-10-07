import type { KeyValueRow, TestDataSet } from "@repo/schemas";
import type { ExecutableStep } from "./types";

/**
 * Data-driven execution.
 *
 * A test case linked to a CSV dataset runs once per row, so one authored case
 * becomes N results. Each expansion keeps its row number so a failure can be
 * traced back to the input that produced it.
 *
 * Tokens are `{{column}}`. They are substituted into step values and targets,
 * which is what lets a case be authored once against a column name rather than
 * re-authored per row. Credential tokens are handled by the executor and are
 * left untouched here.
 */

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export interface DataDrivenCase {
  id: string;
  name: string;
  steps: ExecutableStep[];
  testData: string | null;
  expectedResult: string | null;
  datasetId: string | null;
  /** Zero-based position within the dataset; null when the case is not data-driven. */
  datasetRow: number | null;
  /** Row values available to `{{column}}` substitution. */
  values: KeyValueRow;
  /** Application role the case is written for; selects the credential it runs as. */
  role: string | null;
}

export interface CaseDraft {
  id: string;
  name: string;
  role?: string | null;
  steps: ExecutableStep[];
  testData: string | null;
  expectedResult: string | null;
  datasetId: string | null;
}

export type UnresolvedToken = { column: string };

/**
 * Expands every case into its runnable forms.
 *
 * A case whose dataset is missing or empty runs once, unchanged, rather than
 * silently disappearing: a deleted dataset must not quietly reduce coverage.
 * Problems worth reporting are returned alongside the cases.
 */
export function expandCases(
  drafts: CaseDraft[],
  datasets: Map<string, TestDataSet["data"]>,
): { cases: DataDrivenCase[]; warnings: string[] } {
  const cases: DataDrivenCase[] = [];
  const warnings: string[] = [];

  for (const draft of drafts) {
    if (!draft.datasetId) {
      cases.push(toCase(draft, null, null, {}));
      continue;
    }
    const data = datasets.get(draft.datasetId);
    if (!isCsvData(data)) {
      warnings.push(`"${draft.name}": linked dataset is missing or not CSV; running once without data`);
      cases.push(toCase(draft, draft.datasetId, null, {}));
      continue;
    }
    if (data.rows.length === 0) {
      warnings.push(`"${draft.name}": linked dataset has no rows; running once without data`);
      cases.push(toCase(draft, draft.datasetId, null, {}));
      continue;
    }
    data.rows.forEach((values, index) => {
      cases.push(toCase(draft, draft.datasetId, index, values));
    });
  }

  return { cases, warnings };
}

function toCase(draft: CaseDraft, datasetId: string | null, datasetRow: number | null, values: KeyValueRow): DataDrivenCase {
  return {
    id: draft.id,
    // Rows of the same case are one logical case, so the name stays stable and
    // the row number is carried separately for the report.
    name: draft.name,
    steps: datasetRow === null ? draft.steps : draft.steps.map((step) => substituteStep(step, values)),
    testData: draft.testData,
    expectedResult: draft.expectedResult,
    datasetId,
    datasetRow,
    values,
    role: draft.role ?? null,
  };
}

/** Substitutes `{{name}}` tokens in every step, e.g. a credential's non-secret variables. */
export function applyValues(steps: ExecutableStep[], values: KeyValueRow): ExecutableStep[] {
  return Object.keys(values).length === 0 ? steps : steps.map((step) => substituteStep(step, values));
}

function substituteStep(step: ExecutableStep, values: KeyValueRow): ExecutableStep {
  return {
    ...step,
    target: substituteTokens(step.target, values),
    ...(step.value === undefined ? {} : { value: substituteTokens(step.value, values) }),
  };
}

/**
 * Replaces `{{column}}` tokens with the row's value.
 *
 * An unknown column is left as written rather than blanked, so a typo shows up
 * in the recorded step and the failure message instead of submitting an empty
 * field and reporting a confusing validation error from the application.
 */
export function substituteTokens(text: string, values: KeyValueRow): string {
  return text.replace(TOKEN_PATTERN, (match, column: string) => {
    const value = values[column];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Columns referenced by a case that the dataset does not provide. */
export function findUnresolvedTokens(steps: ExecutableStep[], values: KeyValueRow): UnresolvedToken[] {
  const missing = new Set<string>();
  for (const step of steps) {
    for (const text of [step.target, step.value ?? ""]) {
      for (const match of text.matchAll(TOKEN_PATTERN)) {
        const column = match[1]!;
        if (values[column] === undefined || values[column] === null) missing.add(column);
      }
    }
  }
  return [...missing].map((column) => ({ column }));
}

function isCsvData(data: TestDataSet["data"] | undefined): data is { type: "csv"; columns: string[]; rows: KeyValueRow[] } {
  return !!data && data.type === "csv" && Array.isArray(data.rows);
}

/** Reads datasets for a module into the lookup `expandCases` needs. */
export function indexDatasets(rows: { id: string; data: TestDataSet["data"] }[]): Map<string, TestDataSet["data"]> {
  return new Map(rows.map((row) => [row.id, row.data]));
}
