import { Queue, QueueEvents, Worker, type JobsOptions, type Processor } from "bullmq";
import IORedis from "ioredis";

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