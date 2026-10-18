-- Test management: severity and tags travel with a case through CSV import and
-- export; a run result keeps its Playwright trace and the browser console
-- errors seen while it ran, so a failure can be investigated after the fact.
--
-- Statuses stay varchar: test cases gain NEEDS_REVIEW (no machine-checkable
-- expected outcome yet) and results gain INFRA_ERROR and FLAKY, without an
-- enum migration.
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "severity" varchar(16);
--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "trace_key" text;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "console_errors" jsonb DEFAULT '[]'::jsonb NOT NULL;
