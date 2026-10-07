import { z } from "zod";
import type { testRuns } from "@repo/db/schema";
import type { StorageProvider } from "@repo/core";
import { AttemptRecordSchema, StepResultSchema, formatRunId, type AttemptRecord, type StepResult } from "@repo/schemas";

/**
 * Shapes stored run data for the report. Attempts and step results are JSON
 * written by the worker; they are validated on the way out so a malformed row
 * renders as "no steps" rather than crashing the report.
 */

type RunRow = typeof testRuns.$inferSelect;

export function presentRun(run: RunRow, parent?: RunRow) {
  return {
    ...run,
    runLabel: formatRunId(run.runNumber, run.createdAt),
    parentRunLabel: parent ? formatRunId(parent.runNumber, parent.createdAt) : null,
  };
}

export type StepView = StepResult & { screenshotUrl: string | null };
export type AttemptView = AttemptRecord & { screenshotUrl: string | null };

function parseList<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const parsed = z.array(schema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

interface ResultRow {
  order: number;
  code: string | null;
  screenshotKey: string | null;
  attempts: unknown;
  stepResults: unknown;
}

export function presentResult<T extends ResultRow>(row: T, storage: StorageProvider) {
  const url = (key: string | null) => (key ? storage.getPublicUrl(key) : null);
  return {
    ...row,
    code: row.code ?? `TC-${String(row.order + 1).padStart(4, "0")}`,
    screenshotUrl: url(row.screenshotKey),
    attempts: parseList(AttemptRecordSchema, row.attempts).map((attempt): AttemptView => ({ ...attempt, screenshotUrl: url(attempt.screenshotKey) })),
    stepResults: parseList(StepResultSchema, row.stepResults).map((step): StepView => ({ ...step, screenshotUrl: url(step.screenshotKey) })),
  };
}

/** Every screenshot a run owns: final, per attempt, per step. Used when the run is deleted. */
export function evidenceKeysOf(rows: Array<Pick<ResultRow, "screenshotKey" | "attempts" | "stepResults">>): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.screenshotKey) keys.add(row.screenshotKey);
    for (const attempt of parseList(AttemptRecordSchema, row.attempts)) if (attempt.screenshotKey) keys.add(attempt.screenshotKey);
    for (const step of parseList(StepResultSchema, row.stepResults)) if (step.screenshotKey) keys.add(step.screenshotKey);
  }
  return [...keys];
}
