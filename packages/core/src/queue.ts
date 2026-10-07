import { Queue, QueueEvents, Worker, type JobsOptions, type Processor } from "bullmq";
import IORedis from "ioredis";
import { AppError } from "./errors";

export const DISCOVERY_QUEUE = "discovery";
export const DEFAULT_JOB_TIMEOUT_MS = 15 * 60 * 1000;
export const DISCOVERY_ATTEMPTS = 2;
export const DISCOVERY_BACKOFF = 5000;

export const DISCOVERY_JOB_NAME = "run-module-discovery";

export interface DiscoveryJobData {
  discoverySessionId: string;
  moduleId: string;
  projectId: string;
  role?: string;
}

export function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

const ENQUEUE_TIMEOUT_MS = 10_000;
const CLOSE_TIMEOUT_MS = 2_000;

/**
 * Adds one job and closes the producer, failing fast when Redis is down.
 *
 * Queue connections retry forever (BullMQ requires that for workers), so a bare
 * `queue.add` against a stopped Redis never settles and the HTTP request that
 * triggered it hangs. A producer has a user waiting, so it gets a deadline and a
 * clear 503 instead.
 */
export async function enqueueJob<T>(queue: Queue<T>, name: string, data: T): Promise<void> {
  try {
    await withDeadline(queue.add(name as never, data as never), ENQUEUE_TIMEOUT_MS);
  } catch (error) {
    throw new AppError(
      "QUEUE_UNAVAILABLE",
      `The job queue (Redis) is unavailable: ${error instanceof Error ? error.message : String(error)}. Start Redis (docker compose up -d redis) and retry.`,
      503,
    );
  } finally {
    await withDeadline(queue.close(), CLOSE_TIMEOUT_MS).catch(() => queue.disconnect().catch(() => undefined));
  }
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no response within ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export function createDiscoveryQueue(redisUrl: string, prefix = "autotest"): Queue<DiscoveryJobData> {
  return new Queue<DiscoveryJobData>(DISCOVERY_QUEUE, {
    connection: createRedisConnection(redisUrl),
    prefix,
    defaultJobOptions: {
      attempts: DISCOVERY_ATTEMPTS,
      backoff: { type: "exponential", delay: DISCOVERY_BACKOFF },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
}

export function createDiscoveryQueueEvents(redisUrl: string, prefix = "autotest"): QueueEvents {
  return new QueueEvents(DISCOVERY_QUEUE, {
    connection: createRedisConnection(redisUrl),
    prefix,
  });
}

export function createDiscoveryWorker(
  redisUrl: string,
  processor: Processor<DiscoveryJobData>,
  options: { concurrency?: number; prefix?: string } = {},
): Worker<DiscoveryJobData> {
  return new Worker<DiscoveryJobData>(DISCOVERY_QUEUE, processor, {
    connection: createRedisConnection(redisUrl),
    prefix: options.prefix ?? "autotest",
    concurrency: options.concurrency ?? 2,
  });
}

export const discoveryJobDefaults: JobsOptions = {
  attempts: DISCOVERY_ATTEMPTS,
  backoff: { type: "exponential", delay: DISCOVERY_BACKOFF },
  jobId: undefined,
};

export const TEST_RUN_QUEUE = "test-run";
export const TEST_RUN_JOB_NAME = "run-module-test-suite";
export const TEST_RUN_ATTEMPTS = 1;
export const TEST_RUN_CONCURRENCY = 1;

export interface TestRunJobData {
  testRunId: string;
  moduleId: string;
  projectId: string;
  triggeredBy?: string;
}

export function createTestRunQueue(redisUrl: string, prefix = "autotest"): Queue<TestRunJobData> {
  return new Queue<TestRunJobData>(TEST_RUN_QUEUE, {
    connection: createRedisConnection(redisUrl),
    prefix,
    defaultJobOptions: {
      attempts: TEST_RUN_ATTEMPTS,
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
}

export function createTestRunWorker(
  redisUrl: string,
  processor: Processor<TestRunJobData>,
  options: { prefix?: string } = {},
): Worker<TestRunJobData> {
  return new Worker<TestRunJobData>(TEST_RUN_QUEUE, processor, {
    connection: createRedisConnection(redisUrl),
    prefix: options.prefix ?? "autotest",
    concurrency: TEST_RUN_CONCURRENCY,
  });
}