-- Flatten the hierarchy: a Project IS the application under test.
-- Project gains base_url / environment / production_confirmed (absorbed from applications),
-- modules gain project_id, and the applications table is removed.
-- All project data was intentionally wiped before this migration.

DROP TABLE IF EXISTS applications CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS modules CASCADE;
--> statement-breakpoint

CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"start_path" text,
	"include_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"discovery_status" varchar(24) DEFAULT 'NOT_DISCOVERED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "base_url" text NOT NULL DEFAULT 'http://localhost:3000';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "environment" varchar(24) NOT NULL DEFAULT 'development';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "production_confirmed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modules_project_id_idx" ON "modules" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modules_discovery_status_idx" ON "modules" USING btree ("discovery_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modules_created_at_idx" ON "modules" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_environment_idx" ON "projects" USING btree ("environment");
--> statement-breakpoint

-- Re-attach the module foreign keys that `DROP TABLE modules CASCADE` removed.
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "test_data_sets" ADD CONSTRAINT "test_data_sets_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovered_actions" ADD CONSTRAINT "discovered_actions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovered_elements" ADD CONSTRAINT "discovered_elements_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovery_artifacts" ADD CONSTRAINT "discovery_artifacts_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;
