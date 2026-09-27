import { closeAll } from "@repo/db";
import { createDiscoveryWorker, createChildLogger, logger, DISCOVERY_JOB_NAME } from "@repo/core";
import { env } from "./env";
import { processDiscoveryJob } from "./processor";

const log = createChildLogger({ scope: "worker-bootstrap" });

async function main(): Promise<void> {
  const worker = createDiscoveryWorker(env.REDIS_URL, processDiscoveryJob, {
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, sessionId: job.data.discoverySessionId }, "discovery job completed");
  });

  worker.on("failed", (job, error) => {
    log.error(
      { jobId: job?.id, sessionId: job?.data.discoverySessionId, error: error.message },
      "discovery job failed",
    );
  });

  worker.on("error", (error) => {
    log.error({ error: error.message }, "bullmq worker error");
  });

  log.info(
    {
      workerId: worker.id,
      name: DISCOVERY_JOB_NAME,
      concurrency: env.WORKER_CONCURRENCY,
      headless: env.BROWSER_HEADLESS,
      aiProvider: env.AI_PROVIDER,
      storageDriver: env.STORAGE_DRIVER,
    },
    "autotest discovery worker started",
  );

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down worker");
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    await worker.close();
    await closeAll();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ error: error instanceof Error ? error.message : String(error) }, "fatal worker error");
  process.exit(1);
});