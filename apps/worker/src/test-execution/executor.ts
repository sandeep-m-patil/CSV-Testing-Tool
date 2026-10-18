import type { Browser, Page } from "playwright";
import { AttemptDiagnostics } from "./attempt-diagnostics";
import { isInfrastructureError } from "./step-errors";
import type { StepResult } from "@repo/schemas";
import type { ExecutableStep, Expectation, ResultStatus } from "./types";
import { evaluateExpectation } from "./assertions";
import { describeExpectation } from "./describe-expectation";
import { captureScreenshot, displayValue, evidenceKey, traceKey, type EvidenceSubject, type EvidenceTarget } from "./run-evidence";
import { firstLine, isBlockingError, NAVIGATION_TIMEOUT_MS, runStepWithRecovery, type RunCredential, type StepContext } from "./step-runner";
import type { SemanticResolver } from "./semantic-target";
import type { PageAgent } from "../browser-agent/agent";
import type { StorageState } from "./session-bootstrap";

export interface ExecutableCase {
  id: string;
  name: string;
  steps: ExecutableStep[];
  testData: string | null;
  expectedResult: string | null;
  /** Row index within the linked CSV dataset, or null for a non-data-driven case. */
  datasetRow?: number | null;
  /** Signed-in browser storage for the case's role; null runs signed out. */
  storageState?: StorageState | null;
}

export interface RunContext extends EvidenceTarget {
  browser: Browser;
  /** Substituted into generated steps so stored steps never contain a secret. */
  credential?: RunCredential;
  /** AI fallback for targets the portable hint no longer finds; null disables it. */
  resolver?: SemanticResolver | null;
  /** AI browser agent for GOAL steps; null when no model is configured. */
  agent?: PageAgent | null;
  uploadDir: string;
}

/** One execution of one case (or CSV row). Retries produce several of these. */
export interface AttemptOutcome {
  status: ResultStatus;
  durationMs: number;
  actualResult: string;
  error: string | null;
  screenshotKey: string | null;
  steps: StepResult[];
  /** Playwright trace of a non-passing, credential-free attempt. */
  traceKey: string | null;
  /** Console and uncaught page errors seen during the attempt, secrets masked. */
  consoleErrors: string[];
}

/**
 * How long an expectation is retried before it is declared unmet. A real login
 * POST plus client redirect can take ~2s, so a single sample would report a
 * false failure on a slow-but-correct app.
 */
const EXPECTATION_POLL_MS = 10_000;
const EXPECTATION_POLL_INTERVAL_MS = 250;
/** Observation window for "must not navigate": longer than a real redirect (~2s). */
const NEGATIVE_SETTLE_MS = 3_000;

/** Executes one attempt in an isolated browser context so state cannot leak between cases. */
export async function executeAttempt(ctx: RunContext, testCase: ExecutableCase, attempt: number): Promise<AttemptOutcome> {
  const startedAt = Date.now();
  const context = await ctx.browser.newContext({ ignoreHTTPSErrors: true, ...(testCase.storageState ? { storageState: testCase.storageState } : {}) });
  const subject: EvidenceSubject = { caseName: testCase.name, datasetRow: testCase.datasetRow, attempt };
  // Signed-in attempts are never traced: a trace would hold the password and session cookie.
  const diagnostics = new AttemptDiagnostics(ctx, context, !ctx.credential && !testCase.storageState);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
    await diagnostics.start(page);
    const outcome = await runAttempt(page, ctx, testCase, new StepRecorder(ctx, page, subject), startedAt);
    return { ...outcome, ...(await diagnostics.finish(outcome.status, traceKey(ctx, subject))) };
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function runAttempt(page: Page, ctx: RunContext, testCase: ExecutableCase, recorder: StepRecorder, startedAt: number): Promise<AttemptOutcome> {
  const failure = await runActionSteps(page, testCase.steps, ctx, recorder);
  if (failure) return recorder.outcome(startedAt, failure);
  return verify(page, testCase.steps, recorder, startedAt);
}

interface Verdict {
  status: ResultStatus;
  actual: string;
  error: string | null;
}

/** Runs action steps in order; the first step that cannot complete ends the attempt. */
async function runActionSteps(page: Page, steps: ExecutableStep[], ctx: RunContext, recorder: StepRecorder): Promise<Verdict | null> {
  const stepContext: StepContext = { resolver: ctx.resolver ?? null, agent: ctx.agent ?? null, credential: ctx.credential, uploadDir: ctx.uploadDir };
  for (const step of steps) {
    if (step.stepType === "verify") continue;
    const started = Date.now();
    try {
      const resolvedBy = await runStepWithRecovery(page, step, stepContext);
      await recorder.record(step, { status: "PASS", started, resolvedBy });
    } catch (error) {
      const status: ResultStatus = isInfrastructureError(error) ? "INFRA_ERROR" : isBlockingError(error) ? "BLOCKED" : "FAIL";
      const message = `Step ${step.order} (${step.action} ${step.target}): ${firstLine(error)}`;
      await recorder.record(step, { status, started, error: firstLine(error) });
      return { status, actual: status === "BLOCKED" ? "Step could not be executed" : "Execution error", error: message };
    }
  }
  return null;
}

async function verify(page: Page, steps: ExecutableStep[], recorder: StepRecorder, startedAt: number): Promise<AttemptOutcome> {
  const finalStep = [...steps].reverse().find((step) => step.stepType === "verify");
  if (!finalStep?.expect) {
    await recorder.snapshot("final");
    return recorder.outcome(startedAt, { status: "SKIP", actual: "No machine-checkable expectation; requires manual verification", error: null });
  }
  const started = Date.now();
  const outcome = await awaitExpectation(page, finalStep.expect);
  const status: ResultStatus = outcome.isSatisfied ? "PASS" : "FAIL";
  const error = outcome.isSatisfied ? null : `Expectation not met: expected ${describeExpectation(finalStep.expect)}; observed ${outcome.detail}`;
  await recorder.record(finalStep, { status, started, error: error ?? undefined });
  return recorder.outcome(startedAt, { status, actual: outcome.detail, error });
}

/**
 * Retries the expectation until it holds or the budget runs out. The exception
 * is `stayed_on_page`, which would pass on its first sample; it is re-checked
 * after a full settle window instead, so a late redirect is not missed.
 */
async function awaitExpectation(page: Page, expect: Expectation): Promise<{ isSatisfied: boolean; detail: string }> {
  if (expect.kind === "stayed_on_page") {
    await page.waitForTimeout(NEGATIVE_SETTLE_MS);
    return evaluateExpectation(page, expect);
  }
  const deadline = Date.now() + EXPECTATION_POLL_MS;
  let last = await evaluateExpectation(page, expect);
  while (!last.isSatisfied && Date.now() < deadline) {
    await page.waitForTimeout(EXPECTATION_POLL_INTERVAL_MS);
    last = await evaluateExpectation(page, expect);
  }
  return last;
}

/** Collects per-step results, each with its own screenshot. */
class StepRecorder {
  readonly steps: StepResult[] = [];
  private lastScreenshot: string | null = null;

  constructor(
    private readonly ctx: RunContext,
    private readonly page: Page,
    private readonly subject: { caseName: string; datasetRow?: number | null; attempt: number },
  ) {}

  async snapshot(label: string): Promise<string | null> {
    this.lastScreenshot = await captureScreenshot(this.ctx, this.page, evidenceKey(this.ctx, this.subject, label));
    return this.lastScreenshot;
  }

  async record(step: ExecutableStep, input: { status: ResultStatus; started: number; resolvedBy?: "locator" | "ai"; error?: string }): Promise<void> {
    const screenshotKey = await this.snapshot(`s${step.order}`);
    this.steps.push({
      order: step.order,
      action: step.action,
      target: step.target,
      value: displayValue(step.value, this.ctx.secrets),
      status: input.status,
      durationMs: Date.now() - input.started,
      ...(input.error ? { error: input.error } : {}),
      screenshotKey,
      ...(input.resolvedBy ? { resolvedBy: input.resolvedBy } : {}),
    });
  }

  outcome(startedAt: number, verdict: Verdict): AttemptOutcome {
    return {
      status: verdict.status,
      durationMs: Date.now() - startedAt,
      actualResult: verdict.actual,
      error: verdict.error,
      screenshotKey: this.lastScreenshot,
      steps: this.steps,
      traceKey: null,
      consoleErrors: [],
    };
  }
}

export { NAVIGATION_TIMEOUT_MS };
export type { Expectation, RunCredential };
