import { describe, expect, it } from "vitest";
import type { ResolvedCredential } from "../credentials";
import type { DataDrivenCase } from "./data-driven";
import { filterToKeys, planCase, resultKey } from "./run-plan";

function item(id: string, datasetRow: number | null, role: string | null = null): DataDrivenCase {
  return {
    id,
    name: id,
    steps: [
      { order: 1, action: "GOTO", target: "https://app.test/results", stepType: "action" },
      { order: 2, action: "FILL", target: "label:Lab", value: "{{lab_id}}", stepType: "action" },
    ],
    testData: null,
    expectedResult: null,
    datasetId: null,
    datasetRow,
    values: {},
    role,
  };
}

const analyst: ResolvedCredential = { id: "a", name: "Analyst", role: "ANALYST", username: "u", password: "p", environmentId: null, variables: { lab_id: "LAB-01" } };

describe("filterToKeys", () => {
  it("keeps only the case/row pairs that failed in the parent run", () => {
    const cases = [item("c1", 0), item("c1", 1), item("c2", null)];
    const kept = filterToKeys(cases, new Set([resultKey("c1", 1), resultKey("c2", null)]));
    expect(kept.map((entry) => resultKey(entry.id, entry.datasetRow))).toEqual(["c1:1", "c2:-"]);
  });
});

describe("planCase", () => {
  it("runs as the credential for the case's role and substitutes its variables", () => {
    const planned = planCase(item("c1", null, "ANALYST"), [analyst], { from: "https://app.test", to: null });
    expect(planned.credential?.name).toBe("Analyst");
    expect(planned.executable.steps[1]?.value).toBe("LAB-01");
  });

  it("points navigation at the run's environment", () => {
    const planned = planCase(item("c1", null), [analyst], { from: "https://app.test", to: "https://qa.app.test" });
    expect(planned.executable.steps[0]?.target).toBe("https://qa.app.test/results");
  });
});

describe("testsLoginForm", () => {
  it("keeps login-form cases signed out and gives everything else a session", async () => {
    const { testsLoginForm } = await import("./session-bootstrap");
    expect(testsLoginForm([{ order: 1, action: "FILL", target: "role:password", value: "x", stepType: "action" }])).toBe(true);
    expect(testsLoginForm([{ order: 1, action: "FILL", target: "label:Email", value: "{{password}}", stepType: "action" }])).toBe(true);
    expect(testsLoginForm([{ order: 1, action: "CLICK", target: "text:Approve", stepType: "action" }])).toBe(false);
  });
});
