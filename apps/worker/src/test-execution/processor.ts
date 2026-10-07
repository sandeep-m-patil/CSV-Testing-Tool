import type { Job } from "bullmq";
import { getDb } from "@repo/db";
import { createChildLogger, createStorage, type TestRunJobData } from "@repo/core";
import { env } from "../env";
import { secretsOf } from "../credentials";
import { createJevAgent } from "../jev/factory";
import { createJevResolver } from "./semantic-target";
import { launchBrowser } from "./browsers";
import { runCaseWithRetries } from "./case-runner";
import type { RunContext } from "./executor";
import { runPool } from "./pool";
import { loadRunPlan, type PlannedCase, type RunPlan } from "./run-plan";
import { finishRun, recordResult, startRun } from "./run-recorder";
import type { RunCredential } from "./step-runner";
import { SessionCache, testsLoginForm, type StorageState } from "./session-bootstrap";

const log = createChildLogger({ scope: "test-run-processor" });

/**
 * Executes one test run autonomously:
 *
 *   load cases → load CSV rows → resolve credentials → isolated browser context
 *   per case → execute → assert → screenshot per step → retry → next case
 *
 * Cases run on `workers` parallel contexts. One failing case never stops the
 * run unless fail-fast was requested.
 */
export async function processTestRunJob(job: Job<TestRunJobData>): Promise<void> {
  const { testRunId, moduleId } = job.data;
  const db = getDb();
  const startedAt = Date.now();
  log.info({ jobId: job.id, testRunId, moduleId }, "processing test run job");

  let plan: RunPlan;
  try {
    plan = await loadRunPlan(db, testRunId, moduleId);
  } catch (error) {
    await finishRun(db, testRunId, { status: "FAILED", error: messageOf(error), startedAt });
    throw error;
  }
  // Dataset problems must be visible, not silently reduce coverage.
  for (const warning of plan.warnings) log.warn({ testRunId, moduleId }, warning);

  await startRun(db, testRunId, plan.items.length);
  if (plan.items.length === 0) {
    await finishRun(db, testRunId, { status: "COMPLETED", error: "no runnable test cases (check approval status and rejected cases)", startedAt });
    return;
  }

  try {
    const outcome = await executePlan(plan, { testRunId, moduleId });
    const note = outcome.isStopped ? `fail-fast: stopped after ${outcome.started} of ${plan.items.length} case(s)` : null;
    await finishRun(db, testRunId, { status: "COMPLETED", error: note, startedAt });
  } catch (error) {
    await finishRun(db, testRunId, { status: "FAILED", error: messageOf(error), startedAt });
    throw error;
  }
}

async function executePlan(plan: RunPlan, ids: { testRunId: string; moduleId: string }): Promise<{ isStopped: boolean; started: number }> {
  const db = getDb();
  const secrets = secretsOf(plan.credentials);
  const browser = await launchBrowser(plan.options.browser, env.BROWSER_HEADLESS);
  const ctx: RunContext = {
    browser,
    storage: createStorage({ driver: env.STORAGE_DRIVER, localDir: env.STORAGE_LOCAL_DIR, publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL }),
    moduleId: ids.moduleId,
    runId: ids.testRunId,
    secrets,
    uploadDir: env.UPLOAD_FIXTURES_DIR,
    resolver: createJevResolver(createJevAgent(env, secrets), (message) => log.info(ids, message)),
    log: (message) => log.warn(ids, message),
  };

  const sessions = new SessionCache(browser, { startUrl: plan.startUrl, resolver: ctx.resolver ?? null, log: ctx.log });
  try {
    return await runPool(plan.items, plan.options.workers, async (planned, order) => {
      const credential = toRunCredential(planned);
      const storageState = await sessionFor(sessions, planned, credential);
      const result = await runCaseWithRetries({ ...ctx, credential }, { ...planned.executable, storageState }, plan.options.retries);
      await recordResult(db, { testRunId: ids.testRunId, browser: plan.options.browser, order, planned, result });
      log.info({ ...ids, case: planned.executable.name, row: planned.expanded.datasetRow, status: result.outcome.status, attempts: result.attempts.length }, "test case finished");
      return { shouldStop: plan.options.failFast && (result.outcome.status === "FAIL" || result.outcome.status === "BLOCKED") };
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Signed in as the case's role, unless the case tests the login form itself. */
async function sessionFor(sessions: SessionCache, planned: PlannedCase, credential: RunCredential | undefined): Promise<StorageState | null> {
  if (!credential || !planned.credential || testsLoginForm(planned.executable.steps)) return null;
  return sessions.get(planned.credential.id, credential);
}

function toRunCredential(planned: PlannedCase): RunCredential | undefined {
  const credential = planned.credential;
  return credential?.username && credential.password ? { username: credential.username, password: credential.password } : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
