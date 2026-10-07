import { eq, sql } from "drizzle-orm";
import type { Db } from "@repo/db";
import { testRunResults, testRuns } from "@repo/db/schema";
import type { ResultStatus } from "@repo/schemas";
import type { PlannedCase } from "./run-plan";
import type { CaseResult } from "./case-runner";
import { withDbRetry } from "./db-retry";

/**
 * Writes each result the moment its case finishes and bumps the run counters
 * atomically, so the UI shows live per-case progress and parallel workers never
 * overwrite each other's counts.
 */

const COUNTER: Record<ResultStatus, keyof typeof testRuns.$inferSelect> = {
  PASS: "passedCases",
  FAIL: "failedCases",
  BLOCKED: "blockedCases",
  SKIP: "skippedCases",
};

export async function recordResult(db: Db, input: { testRunId: string; browser: string; order: number; planned: PlannedCase; result: CaseResult }): Promise<void> {
  const { planned, result } = input;
  const { expanded, executable, credential } = planned;
  const outcome = result.outcome;
  await withDbRetry(() => db.insert(testRunResults).values({
    testRunId: input.testRunId,
    testCaseId: expanded.id,
    datasetId: expanded.datasetId,
    datasetRow: expanded.datasetRow,
    status: outcome.status,
    durationMs: result.attempts.reduce((total, attempt) => total + attempt.durationMs, 0),
    // A data-driven row shows the inputs that produced it, not the template.
    testData: expanded.datasetRow === null ? executable.testData : JSON.stringify(expanded.values),
    expectedResult: executable.expectedResult,
    actualResult: outcome.actualResult,
    error: outcome.error,
    screenshotKey: outcome.screenshotKey,
    attempts: result.attempts,
    attemptCount: result.attempts.length,
    stepResults: outcome.steps,
    role: expanded.role,
    credentialName: credential?.name ?? null,
    browser: input.browser,
    order: input.order,
  }));

  const column = testRuns[COUNTER[outcome.status] as "passedCases"];
  await withDbRetry(() =>
    db
      .update(testRuns)
      .set({ [COUNTER[outcome.status]]: sql`${column} + 1` })
      .where(eq(testRuns.id, input.testRunId)),
  );
}

export async function startRun(db: Db, testRunId: string, total: number): Promise<void> {
  await withDbRetry(() =>
    db
      .update(testRuns)
      .set({ status: "RUNNING", startedAt: new Date(), totalCases: total, passedCases: 0, failedCases: 0, skippedCases: 0, blockedCases: 0 })
      .where(eq(testRuns.id, testRunId)),
  );
}

export async function finishRun(db: Db, testRunId: string, input: { status: "COMPLETED" | "FAILED"; error: string | null; startedAt: number }): Promise<void> {
  await withDbRetry(() =>
    db
      .update(testRuns)
      .set({ status: input.status, error: input.error, completedAt: new Date(), durationMs: Date.now() - input.startedAt })
      .where(eq(testRuns.id, testRunId)),
  );
}
