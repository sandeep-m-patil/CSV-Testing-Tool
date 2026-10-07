import { describe, expect, it } from "vitest";
import { TargetNotFoundError } from "./locators";
import { StepBlockedError, isBlockingError, resolveValue } from "./step-runner";
import { resolveUploadFile } from "./uploads";

describe("resolveValue", () => {
  it("substitutes credential tokens in-process", () => {
    expect(resolveValue("{{username}}/{{password}}", { username: "u", password: "p" })).toBe("u/p");
  });

  it("blocks a case that needs a credential the module does not have", () => {
    expect(() => resolveValue("{{password}}", undefined)).toThrow(StepBlockedError);
  });

  it("passes literal values through", () => {
    expect(resolveValue("hello", undefined)).toBe("hello");
  });
});

describe("isBlockingError", () => {
  it("classifies unresolvable targets and blocked steps as BLOCKED, everything else as FAIL", () => {
    expect(isBlockingError(new TargetNotFoundError("missing", "text:Approve"))).toBe(true);
    expect(isBlockingError(new StepBlockedError("no credential"))).toBe(true);
    expect(isBlockingError(new Error("click intercepted"))).toBe(false);
  });
});

describe("resolveUploadFile", () => {
  it("never escapes the fixtures directory", async () => {
    const file = await resolveUploadFile("../../etc/passwd", "./no-such-fixtures");
    expect(file).not.toContain("etc");
    expect(file.endsWith("passwd")).toBe(true);
  });

  it("rejects hidden or unsafe names", async () => {
    await expect(resolveUploadFile(".env", "./fixtures")).rejects.toThrow(StepBlockedError);
  });
});
