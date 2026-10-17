/**
 * Job contracts shared by the web app (producer) and the worker (consumer).
 * The queue itself lives in Postgres (`@repo/db` job-queue); there is no Redis.
 */

export const DISCOVERY_QUEUE = "discovery";
export const DISCOVERY_JOB_NAME = "run-module-discovery";
/** A discovery that crashes is retried once, after an exponential backoff. */
export const DISCOVERY_ATTEMPTS = 2;
export const DISCOVERY_BACKOFF = 5000;

export interface DiscoveryJobData {
  discoverySessionId: string;
  moduleId: string;
  projectId: string;
  role?: string;
}

export const TEST_RUN_QUEUE = "test-run";
export const TEST_RUN_JOB_NAME = "run-module-test-suite";
/** A test run retries its own cases; the run itself is never re-executed from scratch. */
export const TEST_RUN_ATTEMPTS = 1;
/** Runs execute one at a time; each run parallelises its own cases across workers. */
export const TEST_RUN_CONCURRENCY = 1;

export interface TestRunJobData {
  testRunId: string;
  moduleId: string;
  projectId: string;
  triggeredBy?: string;
}
