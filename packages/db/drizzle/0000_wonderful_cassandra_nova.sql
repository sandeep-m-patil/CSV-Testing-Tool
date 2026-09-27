CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"base_url" text NOT NULL,
	"description" text,
	"environment" varchar(24) DEFAULT 'development' NOT NULL,
	"production_confirmed" boolean DEFAULT false NOT NULL,
	"status" varchar(24) DEFAULT 'NOT_DISCOVERED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"discovery_status" varchar(24) DEFAULT 'NOT_DISCOVERED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"role" varchar(120) NOT NULL,
	"username" varchar(255) NOT NULL,
	"secret_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_data_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"data_type" varchar(24) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"action" varchar(24) NOT NULL,
	"target" jsonb NOT NULL,
	"dangerous" boolean DEFAULT false NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"executed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"element_type" varchar(24) NOT NULL,
	"role" varchar(64),
	"name" text,
	"text" text,
	"placeholder" text,
	"label" text,
	"test_id" text,
	"css_selector" text,
	"xpath" text,
	"aria_attributes" jsonb,
	"visible" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"page_type" varchar(24) DEFAULT 'other' NOT NULL,
	"parent_page_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"level" varchar(16) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'QUEUED' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"current_url" text,
	"current_step" text,
	"pages_discovered" integer DEFAULT 0 NOT NULL,
	"actions_discovered" integer DEFAULT 0 NOT NULL,
	"workflows_discovered" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"from_page_id" uuid NOT NULL,
	"to_page_id" uuid NOT NULL,
	"action_id" uuid,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_case_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_case_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"action" varchar(24) NOT NULL,
	"target" text NOT NULL,
	"value" text,
	"step_type" varchar(16) DEFAULT 'action' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"workflow_id" uuid,
	"discovery_session_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"type" varchar(24) NOT NULL,
	"priority" varchar(16) DEFAULT 'MEDIUM' NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"source" varchar(24) DEFAULT 'discovered' NOT NULL,
	"role" varchar(120),
	"precondition" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"action" varchar(24) NOT NULL,
	"target" text NOT NULL,
	"value" text,
	"optional" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"preconditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'DRAFT' NOT NULL,
	"source" varchar(24) DEFAULT 'discovered' NOT NULL,
	"confidence" varchar(8) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid,
	"action_id" uuid,
	"page_id" uuid,
	"artifact_type" varchar(24) NOT NULL,
	"storage_key" text NOT NULL,
	"url" text,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_data_sets" ADD CONSTRAINT "test_data_sets_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_actions" ADD CONSTRAINT "discovered_actions_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_actions" ADD CONSTRAINT "discovered_actions_page_id_discovered_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_actions" ADD CONSTRAINT "discovered_actions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_elements" ADD CONSTRAINT "discovered_elements_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_elements" ADD CONSTRAINT "discovered_elements_page_id_discovered_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_elements" ADD CONSTRAINT "discovered_elements_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD CONSTRAINT "discovered_pages_parent_page_id_discovered_pages_id_fk" FOREIGN KEY ("parent_page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_logs" ADD CONSTRAINT "discovery_logs_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_from_page_id_discovered_pages_id_fk" FOREIGN KEY ("from_page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_to_page_id_discovered_pages_id_fk" FOREIGN KEY ("to_page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_transitions" ADD CONSTRAINT "state_transitions_action_id_discovered_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."discovered_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_case_steps" ADD CONSTRAINT "test_case_steps_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_artifacts" ADD CONSTRAINT "discovery_artifacts_discovery_session_id_discovery_sessions_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_artifacts" ADD CONSTRAINT "discovery_artifacts_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_artifacts" ADD CONSTRAINT "discovery_artifacts_action_id_discovered_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."discovered_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_artifacts" ADD CONSTRAINT "discovery_artifacts_page_id_discovered_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."discovered_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_project_id_idx" ON "applications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "applications_created_at_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modules_application_id_idx" ON "modules" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "modules_discovery_status_idx" ON "modules" USING btree ("discovery_status");--> statement-breakpoint
CREATE INDEX "modules_created_at_idx" ON "modules" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_created_by_idx" ON "projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credentials_module_id_idx" ON "credentials" USING btree ("module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_module_role_unique" ON "credentials" USING btree ("module_id","role");--> statement-breakpoint
CREATE INDEX "test_data_sets_module_id_idx" ON "test_data_sets" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "test_data_sets_created_at_idx" ON "test_data_sets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "discovered_actions_session_id_idx" ON "discovered_actions" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "discovered_actions_page_id_idx" ON "discovered_actions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "discovered_actions_module_id_idx" ON "discovered_actions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "discovered_actions_type_idx" ON "discovered_actions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "discovered_elements_session_id_idx" ON "discovered_elements" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "discovered_elements_page_id_idx" ON "discovered_elements" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "discovered_elements_module_id_idx" ON "discovered_elements" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "discovered_elements_type_idx" ON "discovered_elements" USING btree ("element_type");--> statement-breakpoint
CREATE INDEX "discovered_pages_session_id_idx" ON "discovered_pages" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "discovered_pages_module_id_idx" ON "discovered_pages" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "discovered_pages_order_idx" ON "discovered_pages" USING btree ("discovery_session_id","order");--> statement-breakpoint
CREATE INDEX "discovery_logs_session_id_idx" ON "discovery_logs" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "discovery_logs_created_at_idx" ON "discovery_logs" USING btree ("discovery_session_id","created_at");--> statement-breakpoint
CREATE INDEX "discovery_sessions_module_id_idx" ON "discovery_sessions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "discovery_sessions_status_idx" ON "discovery_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discovery_sessions_created_at_idx" ON "discovery_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "state_transitions_session_id_idx" ON "state_transitions" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "state_transitions_module_id_idx" ON "state_transitions" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "state_transitions_from_page_idx" ON "state_transitions" USING btree ("from_page_id");--> statement-breakpoint
CREATE INDEX "test_case_steps_test_case_id_idx" ON "test_case_steps" USING btree ("test_case_id");--> statement-breakpoint
CREATE INDEX "test_case_steps_order_idx" ON "test_case_steps" USING btree ("test_case_id","order");--> statement-breakpoint
CREATE INDEX "test_cases_module_id_idx" ON "test_cases" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "test_cases_workflow_id_idx" ON "test_cases" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "test_cases_session_id_idx" ON "test_cases" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "test_cases_status_idx" ON "test_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "test_cases_created_at_idx" ON "test_cases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_steps_workflow_id_idx" ON "workflow_steps" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_workflow_order_idx" ON "workflow_steps" USING btree ("workflow_id","order");--> statement-breakpoint
CREATE INDEX "workflows_module_id_idx" ON "workflows" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "workflows_session_id_idx" ON "workflows" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "workflows_status_idx" ON "workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflows_created_at_idx" ON "workflows" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "discovery_artifacts_session_id_idx" ON "discovery_artifacts" USING btree ("discovery_session_id");--> statement-breakpoint
CREATE INDEX "discovery_artifacts_module_id_idx" ON "discovery_artifacts" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "discovery_artifacts_type_idx" ON "discovery_artifacts" USING btree ("artifact_type");--> statement-breakpoint
CREATE INDEX "discovery_artifacts_created_at_idx" ON "discovery_artifacts" USING btree ("created_at");