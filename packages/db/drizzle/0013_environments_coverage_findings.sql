-- Environments, coverage and findings.
--
-- `projects` and `modules` are deliberately untouched: a project keeps its
-- `base_url` and `environment` label, and an environment is an additional
-- deployment target of that same application. Existing discovery sessions and
-- test cases therefore keep working without a data migration.
CREATE TABLE IF NOT EXISTS "environments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "kind" varchar(24) DEFAULT 'development' NOT NULL,
  "base_url" text NOT NULL,
  "base_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "required_credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environments_project_id_idx" ON "environments" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "environments_kind_idx" ON "environments" ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "environments_project_name_idx" ON "environments" ("project_id", "name");

-- Coverage is role x action. A target is something a role should be able to do
-- on a page; a link says which test case covers it; a record is the outcome.
CREATE TABLE IF NOT EXISTS "coverage_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "page_id" uuid REFERENCES "discovered_pages"("id") ON DELETE CASCADE,
  "role" varchar(120) NOT NULL,
  "action" varchar(80) NOT NULL,
  "discovered_action_id" uuid REFERENCES "discovered_actions"("id") ON DELETE SET NULL,
  "label" varchar(200) NOT NULL,
  "is_critical" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_targets_module_id_idx" ON "coverage_targets" ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_targets_role_idx" ON "coverage_targets" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_targets_page_id_idx" ON "coverage_targets" ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coverage_targets_module_role_action_idx"
  ON "coverage_targets" ("module_id", "role", "action", "page_id");

CREATE TABLE IF NOT EXISTS "coverage_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_id" uuid NOT NULL REFERENCES "coverage_targets"("id") ON DELETE CASCADE,
  "test_case_id" uuid NOT NULL REFERENCES "test_cases"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coverage_links_target_case_idx"
  ON "coverage_links" ("target_id", "test_case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_links_test_case_id_idx" ON "coverage_links" ("test_case_id");

CREATE TABLE IF NOT EXISTS "coverage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_id" uuid NOT NULL REFERENCES "coverage_targets"("id") ON DELETE CASCADE,
  "test_run_result_id" uuid NOT NULL REFERENCES "test_run_results"("id") ON DELETE CASCADE,
  "run_id" uuid NOT NULL,
  "status" varchar(8) DEFAULT 'SKIP' NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_records_target_id_idx" ON "coverage_records" ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_records_run_id_idx" ON "coverage_records" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_records_status_idx" ON "coverage_records" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coverage_records_result_attempt_idx"
  ON "coverage_records" ("test_run_result_id", "attempt");

-- Findings are grouped by fingerprint so one defect reads as one issue.
CREATE TABLE IF NOT EXISTS "finding_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "fingerprint" varchar(64) NOT NULL,
  "title" varchar(240) NOT NULL,
  "category" varchar(32) DEFAULT 'functional' NOT NULL,
  "severity" varchar(16) DEFAULT 'medium' NOT NULL,
  "status" varchar(16) DEFAULT 'open' NOT NULL,
  "occurrences" integer DEFAULT 1 NOT NULL,
  "first_seen_run_id" uuid REFERENCES "test_runs"("id") ON DELETE SET NULL,
  "last_seen_run_id" uuid REFERENCES "test_runs"("id") ON DELETE SET NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "finding_groups_module_fingerprint_idx"
  ON "finding_groups" ("module_id", "fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finding_groups_module_status_idx" ON "finding_groups" ("module_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finding_groups_severity_idx" ON "finding_groups" ("severity");

CREATE TABLE IF NOT EXISTS "findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "finding_groups"("id") ON DELETE CASCADE,
  "run_id" uuid REFERENCES "test_runs"("id") ON DELETE CASCADE,
  "environment_id" uuid REFERENCES "environments"("id") ON DELETE SET NULL,
  "page_url" text,
  "title" varchar(240) NOT NULL,
  "detail" text,
  "severity" varchar(16) DEFAULT 'medium' NOT NULL,
  "evidence_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_group_id_idx" ON "findings" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_run_id_idx" ON "findings" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_severity_idx" ON "findings" ("severity");

-- `0011` constrained edges to pages and states to pages, but left the session,
-- module and self-referencing columns dangling, so a state or edge could
-- outlive the crawl it belonged to. `IF NOT EXISTS` guards keep this
-- re-runnable on a database where they are already present.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ui_states_session_id_fkey') THEN
    ALTER TABLE "ui_states" ADD CONSTRAINT "ui_states_session_id_fkey"
      FOREIGN KEY ("discovery_session_id") REFERENCES "discovery_sessions"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ui_states_module_id_fkey') THEN
    ALTER TABLE "ui_states" ADD CONSTRAINT "ui_states_module_id_fkey"
      FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'navigation_edges_session_id_fkey') THEN
    ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_session_id_fkey"
      FOREIGN KEY ("discovery_session_id") REFERENCES "discovery_sessions"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'navigation_edges_module_id_fkey') THEN
    ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_module_id_fkey"
      FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovered_pages_ui_state_id_fkey') THEN
    ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_ui_state_id_fkey"
      FOREIGN KEY ("ui_state_id") REFERENCES "ui_states"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovered_pages_parent_page_id_fkey') THEN
    ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_parent_page_id_fkey"
      FOREIGN KEY ("parent_page_id") REFERENCES "discovered_pages"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
-- Repeated crawls of one session must not multiply the same edge.
CREATE UNIQUE INDEX IF NOT EXISTS "navigation_edges_session_from_to_action_idx"
  ON "navigation_edges" ("discovery_session_id", "from_page_id", "to_page_id", "action");
