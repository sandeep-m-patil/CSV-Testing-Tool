import { z } from "zod";

/**
 * Test-run contract shared by the web app (which starts runs and renders
 * reports) and the worker (which executes them).
 */

export const RUN_BROWSERS = ["chromium", "firefox", "webkit"] as const;
export type RunBrowser = (typeof RUN_BROWSERS)[number];

export const MAX_RUN_WORKERS = 8;
export const MAX_RUN_RETRIES = 3;

export const StartTestRunInputSchema = z.object({
  browser: z.enum(RUN_BROWSERS).default("chromium"),
  workers: z.number().int().min(1).max(MAX_RUN_WORKERS).default(1),
  retries: z.number().int().min(0).max(MAX_RUN_RETRIES).default(0),
  failFast: z.boolean().default(false),
  /** Deployment to run against; null/absent uses the project base URL. */
  environmentId: z.string().uuid().nullable().optional(),
});
export type StartTestRunInput = z.infer<typeof StartTestRunInputSchema>;

/**
 * PASS / FAIL are verdicts of the assertion engine. BLOCKED means the case
 * could not be executed as written (target not found, navigation failed,
 * missing credential or data), which is a different problem from the app
 * misbehaving. SKIP means nothing machine-checkable was asserted.
 */
export const RESULT_STATUSES = ["PASS", "FAIL", "BLOCKED", "SKIP"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const StepResultSchema = z.object({
  order: z.number().int(),
  action: z.string(),
  target: z.string(),
  /** Already masked: credential values never reach a stored step result. */
  value: z.string().optional(),
  status: z.enum(RESULT_STATUSES),
  durationMs: z.number().int(),
  error: z.string().optional(),
  screenshotKey: z.string().nullable(),
  /** How the target was found: the portable hint, or Jev's fallback. */
  resolvedBy: z.enum(["locator", "jev"]).optional(),
});
export type StepResult = z.infer<typeof StepResultSchema>;

export const AttemptRecordSchema = z.object({
  attempt: z.number().int().min(1),
  status: z.enum(RESULT_STATUSES),
  error: z.string().nullable(),
  durationMs: z.number().int(),
  screenshotKey: z.string().nullable(),
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

const RUN_NUMBER_WIDTH = 6;

/** `RUN-2026-000042`: stable, human-readable, and sortable within a year. */
export function formatRunId(runNumber: number, createdAt: Date | string): string {
  const year = new Date(createdAt).getUTCFullYear();
  return `RUN-${year}-${String(runNumber).padStart(RUN_NUMBER_WIDTH, "0")}`;
}
