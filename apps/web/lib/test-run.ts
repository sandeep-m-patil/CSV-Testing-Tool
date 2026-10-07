import { and, eq } from "drizzle-orm";
import { environments, projects, testRuns } from "@repo/db/schema";
import { AppError, createTestRunQueue, enqueueJob, TEST_RUN_JOB_NAME } from "@repo/core";
import type { StartTestRunInput } from "@repo/schemas";
import { db } from "@/lib/db";

/**
 * Creates a run row and queues it. Every call creates a new run: history is
 * never overwritten, and "rerun failed" is its own run pointing at its parent.
 */
export interface EnqueueTestRunInput {
  moduleId: string;
  projectId: string;
  triggeredBy?: string;
  options?: Partial<StartTestRunInput>;
  /** Rerun only the failed/blocked results of this run. */
  parentRunId?: string;
}

export async function enqueueTestRun(input: EnqueueTestRunInput): Promise<string> {
  if (!process.env.REDIS_URL) {
    throw new AppError("REDIS_UNCONFIGURED", "Redis is not configured. Start it with `docker compose up redis` and set REDIS_URL.", 503);
  }
  const options = input.options ?? {};
  const baseUrl = await resolveTargetUrl(input.projectId, options.environmentId ?? null);

  const [runRow] = await db
    .insert(testRuns)
    .values({
      moduleId: input.moduleId,
      projectId: input.projectId,
      triggeredBy: input.triggeredBy ?? null,
      status: "QUEUED",
      environmentId: options.environmentId ?? null,
      baseUrl,
      browser: options.browser ?? "chromium",
      workers: options.workers ?? 1,
      retries: options.retries ?? 0,
      failFast: options.failFast ?? false,
      scope: input.parentRunId ? "failed" : "all",
      parentRunId: input.parentRunId ?? null,
    })
    .returning();
  if (!runRow) throw new AppError("TEST_RUN_FAILED", "Could not create test run", 500);

  try {
    await enqueueJob(createTestRunQueue(process.env.REDIS_URL), TEST_RUN_JOB_NAME, {
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
  }
  return runRow.id;
}

/**
 * The URL a run targets, recorded on the run so a later environment edit cannot
 * rewrite what a historical run tested. Production targets are refused: test
 * runs submit forms and must never be pointed at live systems.
 */
async function resolveTargetUrl(projectId: string, environmentId: string | null): Promise<string> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);
  if (!environmentId) {
    if (project.environment === "production") throw productionBlocked();
    return project.baseUrl;
  }
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.projectId, projectId)))
    .limit(1);
  if (!environment) throw new AppError("NOT_FOUND", "Environment not found in this project", 404);
  if (environment.kind === "production") throw productionBlocked();
  if (!environment.isActive) throw new AppError("ENVIRONMENT_INACTIVE", "This environment is marked inactive", 409);
  return environment.baseUrl;
}

function productionBlocked(): AppError {
  return new AppError("PRODUCTION_BLOCKED", "Test runs are disabled for production environments.", 403);
}
