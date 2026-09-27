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
  applicationId: string;
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