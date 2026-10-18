import type { AttemptRecord } from "@repo/schemas";
import { executeAttempt, type AttemptOutcome, type ExecutableCase, type RunContext } from "./executor";

/**
 * Retries a FAIL, BLOCKED or INFRA_ERROR case up to `retries` more times. Every
 * attempt is kept, and a case that passes only after an earlier attempt did not
 * is reported as FLAKY, never as a clean PASS.
 */

const RETRYABLE: ReadonlySet<string> = new Set(["FAIL", "BLOCKED", "INFRA_ERROR"]);

export interface CaseResult {
  /** The final attempt: its status is the case's status. */
  outcome: AttemptOutcome;
  attempts: AttemptRecord[];
}

export async function runCaseWithRetries(ctx: RunContext, testCase: ExecutableCase, retries: number): Promise<CaseResult> {
  const attempts: AttemptRecord[] = [];
  let outcome: AttemptOutcome | null = null;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    outcome = await executeAttempt(ctx, testCase, attempt).catch((error: unknown) => crashOutcome(error));
    attempts.push({
      attempt,
      status: outcome.status,
      error: outcome.error,
      durationMs: outcome.durationMs,
      screenshotKey: outcome.screenshotKey,
      traceKey: outcome.traceKey,
    });
    if (!RETRYABLE.has(outcome.status)) break;
  }
  const isFlaky = outcome!.status === "PASS" && attempts.length > 1;
  return { outcome: isFlaky ? { ...outcome!, status: "FLAKY" } : outcome!, attempts };
}

/** A browser-level crash (context could not open) is a platform failure in one attempt, not a dead run. */
function crashOutcome(error: unknown): AttemptOutcome {
  return {
    status: "INFRA_ERROR",
    durationMs: 0,
    actualResult: "The test browser failed before the case could run",
    error: error instanceof Error ? error.message : String(error),
    screenshotKey: null,
    steps: [],
    traceKey: null,
    consoleErrors: [],
  };
}
