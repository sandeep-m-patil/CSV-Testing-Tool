import { describe, expect, it } from "vitest";
import type { TestDataSet } from "@repo/schemas";
import type { ExecutableStep } from "./types";
import {
  expandCases,
  findUnresolvedTokens,
  indexDatasets,
  substituteTokens,
  type CaseDraft,
} from "./data-driven";

const fillStep = (target: string, value: string, order = 1): ExecutableStep => ({
  order,
  action: "FILL",
  target,
  value,
  stepType: "action",
});

const gotoStep = (target: string, order = 0): ExecutableStep => ({
  order,
  action: "GOTO",
  target,
  stepType: "action",
});

const csv = (columns: string[], rows: Array<Record<string, string | number>>): TestDataSet["data"] => ({
  type: "csv",
  columns,
  rows,
});

const draft = (overrides: Partial<CaseDraft> = {}): CaseDraft => ({
  id: "case-1",
  name: "Submit result",
  steps: [gotoStep("/results"), fillStep("input:name=result", "{{result}}")],
  testData: null,
  expectedResult: null,
  datasetId: null,
  ...overrides,
});

describe("expandCases", () => {
  it("runs a case once with no row index when no dataset is linked", () => {
    const { cases, warnings } = expandCases([draft()], new Map());
    expect(cases).toHaveLength(1);
    expect(cases[0]!.datasetRow).toBeNull();
    expect(cases[0]!.datasetId).toBeNull();
    expect(cases[0]!.steps[1]!.value).toBe("{{result}}"); // untouched
    expect(warnings).toEqual([]);
  });

  it("fans out one case into one DataDrivenCase per CSV row and substitutes tokens", () => {
    const datasets = indexDatasets([
      {
        id: "ds-1",
        data: csv(
          ["sample_id", "result"],
          [
            { sample_id: "S001", result: 98 },
            { sample_id: "S002", result: 120 },
            { sample_id: "S003", result: 45 },
          ],
        ),
      },
    ]);

    const { cases, warnings } = expandCases([draft({ datasetId: "ds-1" })], datasets);

    expect(warnings).toEqual([]);
    expect(cases).toHaveLength(3);
    expect(cases.map((c) => c.datasetRow)).toEqual([0, 1, 2]);
    expect(cases.map((c) => c.steps[1]!.value)).toEqual(["98", "120", "45"]);
    // The authored case id is preserved so the result still points at the stored
    // case, with the row index as the only distinguishing field.
    expect(new Set(cases.map((c) => c.id)).size).toBe(1);
  });

  it("warns and runs the case once when the linked dataset is missing", () => {
    const { cases, warnings } = expandCases([draft({ datasetId: "ghost" })], new Map());
    expect(cases).toHaveLength(1);
    expect(cases[0]!.datasetRow).toBeNull();
    expect(cases[0]!.datasetId).toBe("ghost");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/missing or not CSV/);
  });

  it("warns and runs the case once when the dataset has no rows", () => {
    const datasets = indexDatasets([{ id: "ds-empty", data: csv(["x"], []) }]);
    const { cases, warnings } = expandCases([draft({ datasetId: "ds-empty" })], datasets);
    expect(cases).toHaveLength(1);
    expect(cases[0]!.datasetRow).toBeNull();
    expect(warnings[0]).toMatch(/has no rows/);
  });

  it("falls back to the authored case once for a key-value (non-CSV) dataset", () => {
    const datasets = indexDatasets([
      { id: "kv", data: { type: "key_value", values: { k: "v" } } satisfies TestDataSet["data"] },
    ]);
    const { cases, warnings } = expandCases([draft({ datasetId: "kv" })], datasets);
    expect(cases).toHaveLength(1);
    expect(cases[0]!.datasetRow).toBeNull();
    expect(warnings[0]).toMatch(/not CSV/);
  });

  it("expands multiple cases independently", () => {
    const datasets = indexDatasets([
      { id: "ds-1", data: csv(["result"], [{ result: 1 }, { result: 2 }]) },
    ]);
    const drafts: CaseDraft[] = [
      draft({ id: "a", datasetId: "ds-1" }),
      draft({ id: "b", datasetId: null }),
    ];
    const { cases } = expandCases(drafts, datasets);
    expect(cases.map((c) => `${c.id}:${c.datasetRow}`)).toEqual(["a:0", "a:1", "b:null"]);
  });
});

describe("substituteTokens", () => {
  it("replaces known columns, leaves unknown ones as-written", () => {
    expect(substituteTokens("hello {{name}} / {{missing}}", { name: "Pat" })).toBe(
      "hello Pat / {{missing}}",
    );
  });

  it("tolerates whitespace inside the token braces", () => {
    expect(substituteTokens("{{  code  }}", { code: "X1" })).toBe("X1");
  });

  it("passes a numeric value through as its string form", () => {
    expect(substituteTokens("{{n}}", { n: 42 })).toBe("42");
  });
});

describe("findUnresolvedTokens", () => {
  it("reports every column the dataset does not provide", () => {
    const steps = [fillStep("{{a}}", "{{b}}")];
    expect(findUnresolvedTokens(steps, { a: "x" })).toEqual([{ column: "b" }]);
  });

  it("dedupes columns referenced more than once", () => {
    const steps = [fillStep("{{a}}", "{{a}}"), fillStep("{{a}}", "{{c}}")];
    expect(findUnresolvedTokens(steps, {})).toEqual([{ column: "a" }, { column: "c" }]);
  });
});
