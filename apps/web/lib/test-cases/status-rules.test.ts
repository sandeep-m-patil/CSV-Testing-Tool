import { describe, expect, it } from "vitest";
import type { ExecutableStep } from "@repo/schemas";
import { statusAfterEdit } from "./status-rules";

const OPEN: ExecutableStep = { order: 1, action: "GOTO", target: "https://shop.test", stepType: "action" };
const CHECK: ExecutableStep = { order: 2, action: "VERIFY", target: "https://shop.test", stepType: "verify", expect: { kind: "app_responsive" } };

describe("statusAfterEdit", () => {
  it("parks a case with no checkable outcome in NEEDS_REVIEW", () => {
    expect(statusAfterEdit([OPEN], "APPROVED")).toBe("NEEDS_REVIEW");
  });

  it("returns a completed case to DRAFT for review", () => {
    expect(statusAfterEdit([OPEN, CHECK], "NEEDS_REVIEW")).toBe("DRAFT");
  });

  it("refuses to approve a case that asserts nothing", () => {
    expect(() => statusAfterEdit([OPEN], "DRAFT", "APPROVED")).toThrow(/checkable/);
  });

  it("keeps a rejection even when the steps change", () => {
    expect(statusAfterEdit([OPEN], "REJECTED")).toBe("REJECTED");
  });
});
