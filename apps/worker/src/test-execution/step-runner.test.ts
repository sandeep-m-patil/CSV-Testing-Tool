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

describe("GOAL steps", () => {
  const goal = { order: 2, action: "GOAL" as const, target: "Register sample S-1 for Chemistry", stepType: "action" as const };

  it("are blocked when no AI model is configured", async () => {
    const { createFakePage } = await import("../browser-agent/fake-page");
    const { runStepWithRecovery } = await import("./step-runner");
    await expect(runStepWithRecovery(createFakePage([]).page, goal, { resolver: null, agent: null, uploadDir: "." })).rejects.toThrow(StepBlockedError);
  });

  it("pass when the agent reaches the goal, and report the AI as the resolver", async () => {
    const { createFakePage, createScriptedAI } = await import("../browser-agent/fake-page");
    const { PageAgent } = await import("../browser-agent/agent");
    const { runStepWithRecovery } = await import("./step-runner");
    const agent = new PageAgent(createScriptedAI([{ operation: "CLICK", ref: 1, confidence: 0.9 }, { operation: "DONE", confidence: 0.9 }]).ai, { secrets: [] });
    const page = createFakePage([{ i: 1, tag: "button", label: "Register" }]).page;
    await expect(runStepWithRecovery(page, goal, { resolver: null, agent, uploadDir: "." })).resolves.toBe("ai");
  });

  it("fail (not block) when the application shows an error", async () => {
    const { createFakePage, createScriptedAI } = await import("../browser-agent/fake-page");
    const { PageAgent } = await import("../browser-agent/agent");
    const { runStepWithRecovery } = await import("./step-runner");
    const agent = new PageAgent(createScriptedAI([{ operation: "CLICK", ref: 1, confidence: 0.9 }, { operation: "ERROR", confidence: 0.9 }]).ai, { secrets: [] });
    const page = createFakePage([{ i: 1, tag: "button", label: "Register" }]).page;
    const error = await runStepWithRecovery(page, goal, { resolver: null, agent, uploadDir: "." }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(isBlockingError(error)).toBe(false);
  });
});
