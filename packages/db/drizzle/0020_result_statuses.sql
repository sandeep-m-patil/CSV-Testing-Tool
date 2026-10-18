-- Two more result statuses get their own run counters, so neither is folded
-- into "failed" or "passed": INFRA_ERROR (the platform failed, not the app)
-- and FLAKY (passed only after an earlier attempt did not).
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "infra_error_cases" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN IF NOT EXISTS "flaky_cases" integer DEFAULT 0 NOT NULL;
