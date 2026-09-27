import type { Job } from "bullmq";
import { asc, eq } from "drizzle-orm";
import { chromium } from "playwright";
import { getDb } from "@repo/db";
import { createChildLogger, createStorage, CredentialCrypto, type TestRunJobData } from "@repo/core";
import { testRunResults, testRuns, testCases, credentials } from "@repo/db/schema";
import { env } from "../env";
import { executeCase, type ExecutableCase, type RunContext } from "./executor";

const log = createChildLogger({ scope: "test-run-processor" });

/** BullMQ processor for TEST_RUN_JOB_NAME: executes a module's test cases and records pass/fail evidence. */
export async function processTestRunJob(job: Job<TestRunJobData>): Promise<void> {
  const { testRunId, moduleId } = job.data;
  const db = getDb();

  log.info({ jobId: job.id, testRunId, moduleId }, "processing test run job");

  await db.update(testRuns).set({ status: "RUNNING", startedAt: new Date() }).where(eq(testRuns.id, testRunId));

  const cases = await loadCases(moduleId);
  if (cases.length === 0) {
    await completeRun(testRunId, 0, 0, 0, "no test cases available to run");
    return;
  }

  const secrets = await loadSecrets(moduleId);
  const browser = await chromium.launch({ headless: env.BROWSER_HEADLESS });
  const storage = createStorage({
    driver: env.STORAGE_DRIVER,
    localDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  });
  const ctx: RunContext = { browser, storage, moduleId, runId: testRunId, secrets, timeoutMs: 0 };

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (const [index, testCase] of cases.entries()) {
      const outcome = await executeCase(ctx, testCase, index);
      if (outcome.status === "PASS") passed += 1;
      if (outcome.status === "FAIL") failed += 1;
      if (outcome.status === "SKIP") skipped += 1;

      await db.insert(testRunResults).values({
        testRunId,
        testCaseId: testCase.id,
        status: outcome.status,
        durationMs: outcome.durationMs,
        testData: testCase.testData,
        expectedResult: testCase.expectedResult,
        actualResult: outcome.actualResult,
        error: outcome.error,
        screenshotKey: outcome.screenshotKey,
        order: index,
      });

      log.info({ testRunId, case: testCase.name, status: outcome.status }, "test case finished");
    }
    await completeRun(testRunId, cases.length, passed, failed, null, skipped);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(testRuns)
      .set({ status: "FAILED", error: message, completedAt: new Date(), totalCases: cases.length, passedCases: passed, failedCases: failed, skippedCases: skipped })
      .where(eq(testRuns.id, testRunId));
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function completeRun(
  testRunId: string,
  total: number,
  passed: number,
  failed: number,
  error: string | null,
  skipped = 0,
): Promise<void> {
  await getDb()
    .update(testRuns)
    .set({ status: "COMPLETED", totalCases: total, passedCases: passed, failedCases: failed, skippedCases: skipped, error, completedAt: new Date() })
    .where(eq(testRuns.id, testRunId));
}

async function loadCases(moduleId: string): Promise<ExecutableCase[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: testCases.id,
      name: testCases.name,
      steps: testCases.steps,
      testData: testCases.testData,
      expectedResult: testCases.expectedResult,
    })
    .from(testCases)
    .where(eq(testCases.moduleId, moduleId))
    .orderBy(asc(testCases.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    steps: (row.steps ?? []) as ExecutableCase["steps"],
    testData: row.testData,
    expectedResult: row.expectedResult,
  }));
}

async function loadSecrets(moduleId: string): Promise<string[]> {
  const rows = await getDb().select().from(credentials).where(eq(credentials.moduleId, moduleId));
  const crypto = new CredentialCrypto();
  const secrets: string[] = [];

  for (const row of rows) {
    secrets.push(row.username);
    try {
      const decrypted = crypto.decryptCredentials(moduleId, row.secretData);
      if (decrypted?.password) secrets.push(decrypted.password);
    } catch {
      log.warn({ moduleId, role: row.role }, "credential decryption failed during test run");
    }
  }
  return secrets;
}
