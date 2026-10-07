import { describe, expect, it } from "vitest";
import type { ResolvedCredential } from "../credentials";
import { credentialFor, isRunnable } from "./case-selection";

function credential(overrides: Partial<ResolvedCredential>): ResolvedCredential {
  return { id: "c", name: "c", role: "ANALYST", username: "u", password: "p", environmentId: null, variables: {}, ...overrides };
}

describe("isRunnable", () => {
  it("never runs a rejected case", () => {
    expect(isRunnable("REJECTED", false)).toBe(false);
    expect(isRunnable("REJECTED", true)).toBe(false);
  });

  it("runs drafts unless the module requires approval", () => {
    expect(isRunnable("DRAFT", false)).toBe(true);
    expect(isRunnable("DRAFT", true)).toBe(false);
  });

  it("runs reviewed cases when approval is required", () => {
    expect(isRunnable("APPROVED", true)).toBe(true);
    expect(isRunnable("READY", true)).toBe(true);
  });
});

describe("credentialFor", () => {
  const analyst = credential({ id: "a", role: "ANALYST" });
  const reviewer = credential({ id: "r", role: "REVIEWER" });

  it("picks the credential acting as the case's role", () => {
    expect(credentialFor([analyst, reviewer], "REVIEWER")?.id).toBe("r");
  });

  it("falls back to the first usable credential for a role-less case", () => {
    expect(credentialFor([analyst, reviewer], null)?.id).toBe("a");
  });

  it("skips credentials whose secret could not be resolved", () => {
    const broken = credential({ id: "b", role: "REVIEWER", password: null });
    expect(credentialFor([broken, analyst], "REVIEWER")?.id).toBe("a");
  });

  it("returns nothing when no credential is usable", () => {
    expect(credentialFor([credential({ password: null })], null)).toBeUndefined();
  });
});
