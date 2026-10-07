import type { AttemptRecord } from "@repo/schemas";
import { executeAttempt, type AttemptOutcome, type ExecutableCase, type RunContext } from "./executor";

/**
 * Retries a FAIL or BLOCKED case up to `retries` more times. Every attempt is
 * kept: the report shows "attempt 1 FAIL, attempt 2 PASS" rather than hiding a
 * flaky case behind its last result.
 */

const RETRYABLE = new Set(["FAIL", "BLOCKED"]);

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
    });
    if (!RETRYABLE.has(outcome.status)) break;
  }
  return { outcome: outcome!, attempts };
}

/** A browser-level crash (context could not open) is one failed attempt, not a dead run. */
function crashOutcome(error: unknown): AttemptOutcome {
  return {
    status: "BLOCKED",
    durationMs: 0,
    actualResult: "Browser context could not be created",
    error: error instanceof Error ? error.message : String(error),
    screenshotKey: null,
    steps: [],
  };
}
