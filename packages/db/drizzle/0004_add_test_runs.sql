CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"triggered_by" uuid,
	"status" varchar(16) DEFAULT 'QUEUED' NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"failed_cases" integer DEFAULT 0 NOT NULL,
	"skipped_cases" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_runs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "test_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"test_case_id" uuid NOT NULL,
	"status" varchar(8) DEFAULT 'SKIP' NOT NULL,
	"duration_ms" integer,
	"test_data" text,
	"expected_result" text,
	"actual_result" text,
	"error" text,
	"screenshot_key" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_run_results_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE cascade,
	CONSTRAINT "test_run_results_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_module_id_idx" ON "test_runs" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_status_idx" ON "test_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_created_at_idx" ON "test_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_run_results_run_id_idx" ON "test_run_results" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_run_results_case_id_idx" ON "test_run_results" USING btree ("test_case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_run_results_status_idx" ON "test_run_results" USING btree ("status");
