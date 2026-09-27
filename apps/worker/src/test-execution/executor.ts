import type { Browser, Page } from "playwright";
import type { StorageProvider } from "@repo/core";
import { maskSensitiveInputs, unmaskSensitiveInputs } from "@repo/browser";
import type { ExecutableStep, Expectation, ResultStatus } from "./types";
import { waitForLocator } from "./locators";
import { evaluateExpectation } from "./assertions";
import { slugify } from "./naming";

export interface ExecutableCase {
  id: string;
  name: string;
  steps: ExecutableStep[];
  testData: string | null;
  expectedResult: string | null;
}

export interface CaseOutcome {
  testCaseId: string;
  status: ResultStatus;
  durationMs: number;
  actualResult: string;
  error: string | null;
  screenshotKey: string | null;
}

export interface RunContext {
  browser: Browser;
  storage: StorageProvider;
  moduleId: string;
  runId: string;
  secrets: string[];
  timeoutMs: number;
}

const NAVIGATION_TIMEOUT_MS = 20000;
const SETTLE_TIMEOUT_MS = 750;

/** Executes one test case in an isolated page so state cannot leak between cases. */
export async function executeCase(ctx: RunContext, testCase: ExecutableCase, order: number): Promise<CaseOutcome> {
  const startedAt = Date.now();
  const context = await ctx.browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

  try {
    for (const step of testCase.steps) {
      if (step.stepType === "verify") continue;
      await performStep(page, step);
    }
    const finalStep = lastVerifyStep(testCase.steps);
    if (!finalStep?.expect) {
      return finish(ctx, page, testCase, startedAt, order, {
        status: "SKIP",
        actual: "No machine-checkable expectation; requires manual verification",
      });
    }
    const outcome = await evaluateExpectation(page, finalStep.expect);
    return finish(ctx, page, testCase, startedAt, order, {
      status: outcome.isSatisfied ? "PASS" : "FAIL",
      actual: outcome.detail,
    });
  } catch (error) {
    return finish(ctx, page, testCase, startedAt, order, {
      status: "FAIL",
      actual: "Execution error",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function performStep(page: Page, step: ExecutableStep): Promise<void> {
  switch (step.action) {
    case "GOTO":
      await page.goto(step.target, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
      return;
    case "FILL": {
      const locator = await waitForLocator(page, step.target);
      await locator.fill(step.value ?? "");
      return;
    }
    case "PRESS": {
      const locator = await waitForLocator(page, step.target);
      await locator.press(step.value ?? "Enter");
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(SETTLE_TIMEOUT_MS);
      return;
    }
    case "CLICK": {
      const locator = await waitForLocator(page, step.target);
      await locator.click();
      return;
    }
    case "SUBMIT": {
      const locator = await waitForLocator(page, step.target);
      await locator.click();
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(SETTLE_TIMEOUT_MS);
      return;
    }
    case "SELECT":
    case "CHECK":
    case "UNCHECK": {
      const locator = await waitForLocator(page, step.target);
      await locator.click();
      return;
    }
    default:
      return;
  }
}

function lastVerifyStep(steps: ExecutableStep[]): ExecutableStep | undefined {
  return [...steps].reverse().find((step) => step.stepType === "verify");
}

interface FinishInput {
  status: ResultStatus;
  actual: string;
  error?: string;
}

async function finish(
  ctx: RunContext,
  page: Page,
  testCase: ExecutableCase,
  startedAt: number,
  order: number,
  input: FinishInput,
): Promise<CaseOutcome> {
  void order;
  const screenshotKey = await captureRunEvidence(ctx, page, testCase);
  return {
    testCaseId: testCase.id,
    status: input.status,
    durationMs: Date.now() - startedAt,
    actualResult: input.actual,
    error: input.error ?? null,
    screenshotKey,
  };
}

async function captureRunEvidence(ctx: RunContext, page: Page, testCase: ExecutableCase): Promise<string | null> {
  try {
    await maskSensitiveInputs(page, ctx.secrets);
    const buffer = await page.screenshot({ type: "png", fullPage: false, scale: "css", animations: "disabled" });
    await unmaskSensitiveInputs(page);
    const key = `modules/${ctx.moduleId}/runs/${ctx.runId}/${slugify(testCase.name)}.png`;
    await ctx.storage.put(key, Buffer.from(buffer), "image/png");
    return key;
  } catch {
    return null;
  }
}

export { NAVIGATION_TIMEOUT_MS };
export type { Expectation };
