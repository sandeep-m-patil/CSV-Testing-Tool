import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptOutcome, ExecutableCase, RunContext } from "./executor";
import { isInfrastructureError } from "./step-errors";

const executeAttempt = vi.fn<(ctx: RunContext, testCase: ExecutableCase, attempt: number) => Promise<AttemptOutcome>>();
vi.mock("./executor", () => ({ executeAttempt: (...args: Parameters<typeof executeAttempt>) => executeAttempt(...args) }));

const { runCaseWithRetries } = await import("./case-runner");

function outcome(status: AttemptOutcome["status"], traceKey: string | null = null): AttemptOutcome {
  return { status, durationMs: 5, actualResult: status, error: status === "PASS" ? null : "boom", screenshotKey: null, steps: [], traceKey, consoleErrors: [] };
}

const CTX = {} as RunContext;
const CASE = { id: "c1", name: "Checkout", steps: [], testData: null, expectedResult: null } as ExecutableCase;

describe("runCaseWithRetries", () => {
  beforeEach(() => executeAttempt.mockReset());

  it("reports a pass after a failed attempt as FLAKY and keeps every attempt", async () => {
    executeAttempt.mockResolvedValueOnce(outcome("FAIL", "trace-1.zip")).mockResolvedValueOnce(outcome("PASS"));
    const result = await runCaseWithRetries(CTX, CASE, 2);
    expect(result.outcome.status).toBe("FLAKY");
    expect(result.attempts.map((attempt) => [attempt.status, attempt.traceKey])).toEqual([["FAIL", "trace-1.zip"], ["PASS", null]]);
  });

  it("keeps a first-time pass a clean PASS", async () => {
    executeAttempt.mockResolvedValueOnce(outcome("PASS"));
    expect((await runCaseWithRetries(CTX, CASE, 2)).outcome.status).toBe("PASS");
  });

  it("turns a browser crash into INFRA_ERROR and retries it", async () => {
    executeAttempt.mockRejectedValueOnce(new Error("browserType.launch: crashed")).mockResolvedValueOnce(outcome("FAIL"));
    const result = await runCaseWithRetries(CTX, CASE, 1);
    expect(result.attempts.map((attempt) => attempt.status)).toEqual(["INFRA_ERROR", "FAIL"]);
  });
});

describe("isInfrastructureError", () => {
  it("recognises a torn-down page or browser", () => {
    expect(isInfrastructureError(new Error("locator.click: Target page, context or browser has been closed"))).toBe(true);
    expect(isInfrastructureError(new Error("browser has disconnected"))).toBe(true);
  });

  it("does not blame the platform for an app failure", () => {
    expect(isInfrastructureError(new Error("Expectation not met: expected text Welcome"))).toBe(false);
  });
});
