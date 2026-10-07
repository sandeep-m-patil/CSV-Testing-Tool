-- Execution engine: readable run ids, run options, attempts and per-step evidence.
--
-- Every run keeps its own rows forever: a retry is an attempt inside the same
-- result, and "rerun failed" creates a new run pointing at its parent, so a
-- historical run is never rewritten.
CREATE SEQUENCE IF NOT EXISTS "test_run_number_seq";
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "run_number" bigint;
--> statement-breakpoint
-- Existing runs are numbered in the order they were created.
UPDATE "test_runs" AS t SET "run_number" = numbered."n"
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "n" FROM "test_runs") AS numbered
WHERE t."id" = numbered."id" AND t."run_number" IS NULL;
--> statement-breakpoint
SELECT setval('test_run_number_seq', COALESCE((SELECT max("run_number") FROM "test_runs"), 0) + 1, false);
--> statement-breakpoint
ALTER TABLE "test_runs" ALTER COLUMN "run_number" SET DEFAULT nextval('test_run_number_seq');
--> statement-breakpoint
ALTER TABLE "test_runs" ALTER COLUMN "run_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "test_runs_run_number_idx" ON "test_runs" ("run_number");
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "test_runs" AS t SET "project_id" = m."project_id" FROM "modules" AS m WHERE t."module_id" = m."id" AND t."project_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_project_id_idx" ON "test_runs" ("project_id");
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "browser" varchar(16) DEFAULT 'chromium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "workers" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "retries" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "fail_fast" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "scope" varchar(16) DEFAULT 'all' NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "parent_run_id" uuid REFERENCES "test_runs"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "blocked_cases" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "attempts" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "step_results" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "role" varchar(120);
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "credential_name" varchar(120);
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "browser" varchar(16);
