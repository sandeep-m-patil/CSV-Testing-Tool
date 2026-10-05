ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ai_page_type" varchar(24);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ai_purpose" text;
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ai_fields" jsonb;
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ai_actions" jsonb;
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ai_source" varchar(16);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "role" varchar(120);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_pages_role_idx" ON "discovered_pages" ("module_id", "role");