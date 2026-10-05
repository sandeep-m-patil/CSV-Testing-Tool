import { describe, expect, it } from "vitest";
import { findingFingerprint, groupFindings, summariseFindings, type FindingInput } from "./grouping";

function finding(overrides: Partial<FindingInput> = {}): FindingInput {
  return {
    title: "Checkout total does not match cart",
    category: "functional",
    severity: "high",
    pageUrl: "https://shop.test/checkout",
    detail: "expected 42, got 43",
    evidenceKey: "runs/1/checkout.png",
    runId: "run-1",
    environmentId: "env-1",
    ...overrides,
  };
}

describe("findingFingerprint", () => {
  it("is stable across runs and environments", () => {
    const first = findingFingerprint(finding({ runId: "run-1", environmentId: "env-1" }));
    const second = findingFingerprint(finding({ runId: "run-9", environmentId: "env-7" }));
    expect(second).toBe(first);
  });

  it("ignores evidence storage keys", () => {
    expect(findingFingerprint(finding({ evidenceKey: "a.png" }))).toBe(
      findingFingerprint(finding({ evidenceKey: "b.png" })),
    );
  });

  it("ignores a severity change on the same defect", () => {
    expect(findingFingerprint(finding({ severity: "critical" }))).toBe(
      findingFingerprint(finding({ severity: "medium" })),
    );
  });

  it("separates different defects on the same page", () => {
    expect(findingFingerprint(finding({ title: "Total mismatch" }))).not.toBe(
      findingFingerprint(finding({ title: "Pay button missing" })),
    );
  });

  it("does not let a query string fragment a group", () => {
    expect(findingFingerprint(finding({ pageUrl: "https://shop.test/cart?ref=a" }))).toBe(
      findingFingerprint(finding({ pageUrl: "https://shop.test/cart" })),
    );
  });

  it("ignores volatile values in the detail text", () => {
    expect(findingFingerprint(finding({ detail: "at 2026-01-10T00:00:00Z id 42" }))).toBe(
      findingFingerprint(finding({ detail: "at 2026-02-11T11:11:11Z id 99" })),
    );
  });
});

describe("groupFindings", () => {
  it("collapses the same failure seen on two runs into one group", () => {
    const groups = groupFindings([
      finding({ runId: "run-1", environmentId: "env-1" }),
      finding({ runId: "run-2", environmentId: "env-2" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.occurrences).toHaveLength(2);
  });

  it("keeps the same defect on two pages apart, because a page must stay locatable", () => {
    const groups = groupFindings([
      finding({ pageUrl: "https://shop.test/cart" }),
      finding({ pageUrl: "https://shop.test/checkout" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps unrelated defects apart", () => {
    const groups = groupFindings([
      finding({ title: "Total mismatch" }),
      finding({ title: "Pay button missing" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("escalates a group's severity to the worst observed", () => {
    const groups = groupFindings([finding({ severity: "low" }), finding({ severity: "critical" })]);
    expect(groups[0]?.severity).toBe("critical");
  });

  it("orders groups by severity", () => {
    const groups = groupFindings([
      finding({ title: "Minor copy issue", severity: "low" }),
      finding({ title: "Checkout broken", severity: "critical" }),
    ]);
    expect(groups.map((group) => group.severity)).toEqual(["critical", "low"]);
  });
});

describe("summariseFindings", () => {
  it("counts groups rather than occurrences", () => {
    const groups = groupFindings([finding({ runId: "run-1" }), finding({ runId: "run-2" })]);
    expect(summariseFindings(groups).total).toBe(1);
  });

  it("reports a recurring group separately", () => {
    const groups = groupFindings([finding({ runId: "run-1" }), finding({ runId: "run-2" })]);
    const summary = summariseFindings(groups);
    expect(summary.recurring).toBe(1);
    expect(summary.bySeverity.high).toBe(1);
  });

  it("returns zero for a clean run instead of dividing by zero", () => {
    const summary = summariseFindings([]);
    expect(summary.percentage).toBe(0);
    expect(summary.total).toBe(0);
  });
});
