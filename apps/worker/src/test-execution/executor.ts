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
  /** Surfaces non-fatal capture problems; evidence failures must never be silent. */
  log?: (message: string) => void;
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
      // `return await` is required: a bare `return promise` lets the `finally`
      // block close the context before the screenshot in finish() settles.
      return await finish(ctx, page, testCase, startedAt, order, {
        status: "SKIP",
        actual: "No machine-checkable expectation; requires manual verification",
      });
    }
    const outcome = await evaluateExpectation(page, finalStep.expect);
    return await finish(ctx, page, testCase, startedAt, order, {
      status: outcome.isSatisfied ? "PASS" : "FAIL",
      actual: outcome.detail,
      // A failure must carry its reason, otherwise the report shows a red row
      // with no explanation of which expectation was not met.
      error: outcome.isSatisfied
        ? undefined
        : `Expectation not met: expected ${describeExpectation(finalStep.expect)}; observed ${outcome.detail}`,
    });
  } catch (error) {
    return await finish(ctx, page, testCase, startedAt, order, {
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
  } catch (error) {
    // Never swallow this silently: a missing screenshot is invisible evidence loss,
    // and an empty catch here previously hid a 100% failure rate.
    ctx.log?.(`evidence capture failed for "${testCase.name}": ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export { NAVIGATION_TIMEOUT_MS };
export type { Expectation };

/** Human-readable form of an expectation, used in failure messages. */
function describeExpectation(expectation: Expectation): string {
  switch (expectation.kind) {
    case "navigated_away":
      return `navigation away from ${expectation.fromUrl}`;
    case "stayed_on_page":
      return `to remain on ${expectation.fromUrl}`;
    case "error_message_present":
      return "an error message to be shown";
    case "any_of":
      return `one of [${expectation.options.map(describeExpectation).join(" | ")}]`;
    default:
      return "an unrecognised expectation";
  }
}
