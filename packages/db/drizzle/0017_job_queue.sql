-- Job queue in Postgres, replacing Redis/BullMQ.
--
-- The web app inserts a row; workers claim rows with FOR UPDATE SKIP LOCKED so
-- concurrent workers never take the same job. A running job's lock is renewed
-- by a heartbeat; a lock that goes stale (worker crashed) is put back in the
-- queue, so no job is stranded in "running".
CREATE TABLE IF NOT EXISTS "job_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "queue" varchar(32) NOT NULL,
  "name" varchar(64) NOT NULL,
  "data" jsonb NOT NULL,
  "status" varchar(16) DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 1 NOT NULL,
  "backoff_ms" integer DEFAULT 5000 NOT NULL,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" varchar(64),
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_queue_claim_idx" ON "job_queue" ("queue", "status", "run_after");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_queue_locked_idx" ON "job_queue" ("status", "locked_at");
