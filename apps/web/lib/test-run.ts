import { eq } from "drizzle-orm";
import { testRuns } from "@repo/db/schema";
import { AppError, createTestRunQueue, TEST_RUN_JOB_NAME } from "@repo/core";
import { db } from "@/lib/db";

/**
 * Enqueue a Playwright execution of every test case belonging to a module.
 * Each case runs in its own browser context and records a pass/fail result
 * with screenshot evidence.
 */
export async function enqueueTestRun(input: {
  moduleId: string;
  projectId: string;
  triggeredBy?: string;
}): Promise<string> {
  if (!process.env.REDIS_URL) {
    throw new AppError(
      "REDIS_UNCONFIGURED",
      "Redis is not configured. Start it with `docker compose up redis` and set REDIS_URL.",
      503,
    );
  }

  const [runRow] = await db
    .insert(testRuns)
    .values({ moduleId: input.moduleId, triggeredBy: input.triggeredBy ?? null, status: "QUEUED" })
    .returning();
  if (!runRow) {
    throw new AppError("TEST_RUN_FAILED", "Could not create test run", 500);
  }

  const queue = createTestRunQueue(process.env.REDIS_URL);
  try {
    await queue.add(TEST_RUN_JOB_NAME, {
      testRunId: runRow.id,
      moduleId: input.moduleId,
      projectId: input.projectId,
      triggeredBy: input.triggeredBy,
    });
  } catch (error) {
    await db
      .update(testRuns)
      .set({ status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() })
      .where(eq(testRuns.id, runRow.id));
    throw error;
  } finally {
    await queue.close();
  }

  return runRow.id;
}
