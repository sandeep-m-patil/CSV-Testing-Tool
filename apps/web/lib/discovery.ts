import { and, eq } from "drizzle-orm";
import { discoverySessions, modules, projects } from "@repo/db/schema";
import { enqueueJob } from "@repo/db";
import { AppError, DISCOVERY_ATTEMPTS, DISCOVERY_BACKOFF, DISCOVERY_JOB_NAME, DISCOVERY_QUEUE } from "@repo/core";
import { db } from "@/lib/db";
import { assertTestingAuthorized } from "@/lib/test-authorization";

export const DEFAULT_MODULE_NAME = "Whole site";

export interface ProvisionResult {
  moduleId: string;
  discoverySessionId: string;
}

/**
 * Enqueue a discovery run for a module. Refuses production projects because
 * autonomous crawling is never allowed against them.
 */
export async function enqueueDiscovery(input: {
  moduleId: string;
  projectId: string;
  role?: string;
}): Promise<string> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }
  if (project.environment === "production") {
    throw new AppError(
      "PRODUCTION_BLOCKED",
      "Autonomous discovery is disabled for production environments.",
      403,
    );
  }
  assertTestingAuthorized(project, project.baseUrl);

  const [sessionRow] = await db
    .insert(discoverySessions)
    .values({ moduleId: input.moduleId, status: "QUEUED" })
    .returning();
  if (!sessionRow) {
    throw new AppError("DISCOVERY_FAILED", "Could not create discovery session", 500);
  }

  try {
    await enqueueJob(db, {
      queue: DISCOVERY_QUEUE,
      name: DISCOVERY_JOB_NAME,
      maxAttempts: DISCOVERY_ATTEMPTS,
      backoffMs: DISCOVERY_BACKOFF,
      data: { discoverySessionId: sessionRow.id, moduleId: input.moduleId, projectId: input.projectId, role: input.role },
    });
  } catch (error) {
    // A session nobody will ever pick up must not sit in QUEUED forever.
    await db
      .update(discoverySessions)
      .set({ status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() })
      .where(eq(discoverySessions.id, sessionRow.id));
    throw error;
  }

  // Lifecycle (`status`) is left alone: discovery must never re-enable a module the user disabled.
  await db
    .update(modules)
    .set({ discoveryStatus: "DISCOVERING", updatedAt: new Date() })
    .where(eq(modules.id, input.moduleId));

  return sessionRow.id;
}

/**
 * Give a project a whole-site module and immediately start discovering it.
 * Idempotent per module: a project that already has a whole-site module reuses
 * it instead of stacking up duplicates, so the action can be retried safely.
 */
export async function provisionProjectDiscovery(projectId: string): Promise<ProvisionResult> {
  const [existing] = await db
    .select()
    .from(modules)
    .where(and(eq(modules.projectId, projectId), eq(modules.name, DEFAULT_MODULE_NAME)))
    .limit(1);

  const moduleRow =
    existing ??
    (
      await db
        .insert(modules)
        .values({
          projectId,
          name: DEFAULT_MODULE_NAME,
          description: "Every page of the project base URL.",
          startPath: null,
          includePaths: [],
        })
        .returning()
    )[0];

  if (!moduleRow) {
    throw new AppError("DISCOVERY_FAILED", "Could not create the default module", 500);
  }

  const discoverySessionId = await enqueueDiscovery({
    moduleId: moduleRow.id,
    projectId,
  });

  return { moduleId: moduleRow.id, discoverySessionId };
}
