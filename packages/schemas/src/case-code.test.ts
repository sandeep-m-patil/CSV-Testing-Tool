import { describe, expect, it } from "vitest";
import { moduleCodeSlug, nextCaseCode } from "./case-code";

describe("nextCaseCode", () => {
  it("continues after the highest code of the module", () => {
    expect(nextCaseCode("Whole site", ["WHOLE-SITE-TC-001", "WHOLE-SITE-TC-023", "IMP-001", null])).toBe("WHOLE-SITE-TC-024");
  });

  it("starts at 001 for a module without codes", () => {
    expect(nextCaseCode("Checkout", [])).toBe("CHECKOUT-TC-001");
  });
});

describe("moduleCodeSlug", () => {
  it("uppercases, dashes and truncates the module name", () => {
    expect(moduleCodeSlug("Material Approval")).toBe("MATERIAL-APP");
    expect(moduleCodeSlug("✓✓")).toBe("MOD");
  });
});
