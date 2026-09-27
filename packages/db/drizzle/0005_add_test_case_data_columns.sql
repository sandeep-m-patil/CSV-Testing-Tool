ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "test_data" text;--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "expected_result" text;
