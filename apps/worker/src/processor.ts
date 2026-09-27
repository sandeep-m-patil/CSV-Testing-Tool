import type { Job } from "bullmq";
import { getDb } from "@repo/db";
import { createChildLogger, type DiscoveryJobData } from "@repo/core";
import { runDiscovery } from "./discovery/runner";

const log = createChildLogger({ scope: "discovery-processor" });

/**
 * BullMQ processor for DISCOVERY_JOB_NAME.
 * Loads row data from the queue, spins up a browser session, and runs the
 * indexed action-space discovery loop for the module.
 */
export async function processDiscoveryJob(job: Job<DiscoveryJobData>): Promise<void> {
  const { discoverySessionId, moduleId, applicationId, projectId, role } = job.data;
  const db = getDb();

  log.info(
    { jobId: job.id, discoverySessionId, moduleId, applicationId, role: role ?? null },
    "processing discovery job",
  );

  try {
    await runDiscovery({ discoverySessionId, moduleId, applicationId, projectId, role, db });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ jobId: job.id, discoverySessionId, moduleId, error: message }, "discovery job failed");
    throw error;
  }
}