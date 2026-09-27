ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "code" varchar(64);--> statement-breakpoint
UPDATE "test_cases" SET "code" = sub.code FROM (SELECT "id", 'TC-' || lpad(row_number() OVER (PARTITION BY "module_id" ORDER BY "created_at", "name")::text, 4, '0') AS code FROM "test_cases" WHERE "code" IS NULL) AS sub WHERE "test_cases"."id" = sub."id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "test_cases_module_code_idx" ON "test_cases" USING btree ("module_id","code");
