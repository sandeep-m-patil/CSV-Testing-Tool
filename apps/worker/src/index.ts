import { env } from "./env";
import { closeAll, getDb, startJobWorker } from "@repo/db";
import {
  createChildLogger,
  logger,
  DISCOVERY_QUEUE,
  TEST_RUN_CONCURRENCY,
  TEST_RUN_QUEUE,
  type DiscoveryJobData,
  type TestRunJobData,
} from "@repo/core";
import { processDiscoveryJob } from "./processor";
import { processTestRunJob } from "./test-execution/processor";

const log = createChildLogger({ scope: "worker-bootstrap" });
const SHUTDOWN_GRACE_MS = 10_000;

/** Starts one Postgres-queue worker per queue; jobs live in Neon, not Redis. */
function main(): void {
  const db = getDb();
  const discovery = startJobWorker<DiscoveryJobData>({
    db,
    queue: DISCOVERY_QUEUE,
    concurrency: env.WORKER_CONCURRENCY,
    handler: processDiscoveryJob,
    onCompleted: (job) => log.info({ jobId: job.id, sessionId: job.data.discoverySessionId }, "discovery job completed"),
    onError: (error, job) =>
      log.error({ jobId: job?.id, sessionId: job?.data.discoverySessionId, attempt: job?.attempt, error: messageOf(error) }, "discovery job error"),
  });
  const testRuns = startJobWorker<TestRunJobData>({
    db,
    queue: TEST_RUN_QUEUE,
    concurrency: TEST_RUN_CONCURRENCY,
    handler: processTestRunJob,
    onCompleted: (job) => log.info({ jobId: job.id, testRunId: job.data.testRunId }, "test run job completed"),
    onError: (error, job) => log.error({ jobId: job?.id, testRunId: job?.data.testRunId, error: messageOf(error) }, "test run job error"),
  });

  log.info(
    {
      discoveryWorker: discovery.id,
      testRunWorker: testRuns.id,
      concurrency: env.WORKER_CONCURRENCY,
      headless: env.BROWSER_HEADLESS,
      aiProvider: env.AI_PROVIDER,
      storageDriver: env.STORAGE_DRIVER,
    },
    "autotest worker started (Postgres job queue)",
  );

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down worker");
    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS);
    forceExit.unref();
    await Promise.all([discovery.close(), testRuns.close()]);
    await closeAll();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

try {
  main();
} catch (error) {
  logger.error({ error: messageOf(error) }, "fatal worker error");
  process.exit(1);
}
