-- Data-driven test execution and environment targeting.
--
-- A test case is executed once per CSV row, so a result has to say which row
-- produced it, and a run has to record the deployment it was pointed at. Both
-- are recorded rather than inferred: a later environment rename must not be
-- able to rewrite what a historical run actually tested.
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "dataset_id" uuid REFERENCES "test_data_sets"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_cases_dataset_id_idx" ON "test_cases" ("dataset_id");

ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "environment_id" uuid REFERENCES "environments"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "base_url" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_environment_id_idx" ON "test_runs" ("environment_id");

ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "dataset_id" uuid REFERENCES "test_data_sets"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "test_run_results" ADD COLUMN IF NOT EXISTS "dataset_row" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_run_results_dataset_id_idx" ON "test_run_results" ("dataset_id");
