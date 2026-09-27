ALTER TABLE "modules" ADD COLUMN "start_path" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "include_paths" jsonb DEFAULT '[]'::jsonb NOT NULL;
