ALTER TABLE "discovered_elements" ADD COLUMN IF NOT EXISTS "input_type" varchar(32);
--> statement-breakpoint
ALTER TABLE "discovered_elements" ADD COLUMN IF NOT EXISTS "autocomplete" varchar(32);
