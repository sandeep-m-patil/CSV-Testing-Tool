ALTER TABLE "credentials" ALTER COLUMN "username" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "credentials" SET "field_keys" = '["username", "password"]'::jsonb WHERE "username" IS NOT NULL;
