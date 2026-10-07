import { describe, expect, it } from "vitest";
import { rebaseSteps, rebaseUrl } from "./environment-target";
import type { ExecutableStep } from "./types";

describe("rebaseUrl", () => {
  it("moves a URL on the recorded origin to the target environment", () => {
    expect(rebaseUrl("https://app.test/results/7?tab=a", "https://app.test", "https://qa.app.test")).toBe("https://qa.app.test/results/7?tab=a");
  });

  it("carries path prefixes across", () => {
    expect(rebaseUrl("https://host.test/lims/samples", "https://host.test/lims", "https://qa.test/app")).toBe("https://qa.test/app/samples");
  });

  it("leaves third-party URLs alone", () => {
    expect(rebaseUrl("https://sso.vendor.test/login", "https://app.test", "https://qa.app.test")).toBe("https://sso.vendor.test/login");
  });
});

describe("rebaseSteps", () => {
  const steps: ExecutableStep[] = [
    { order: 1, action: "GOTO", target: "https://app.test/login", stepType: "action" },
    { order: 2, action: "FILL", target: "label:Email", value: "x", stepType: "action" },
    { order: 3, action: "VERIFY", target: "https://app.test/login", stepType: "verify", expect: { kind: "navigated_away", fromUrl: "https://app.test/login" } },
  ];

  it("rewrites navigation and URL expectations but not element hints", () => {
    const rebased = rebaseSteps(steps, "https://app.test", "https://qa.app.test");
    expect(rebased.map((step) => step.target)).toEqual(["https://qa.app.test/login", "label:Email", "https://qa.app.test/login"]);
    expect(rebased[2]?.expect).toEqual({ kind: "navigated_away", fromUrl: "https://qa.app.test/login" });
  });

  it("is a no-op without a target environment", () => {
    expect(rebaseSteps(steps, "https://app.test", null)).toBe(steps);
  });
});
