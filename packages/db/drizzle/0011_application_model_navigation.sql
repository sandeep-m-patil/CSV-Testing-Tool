CREATE TABLE IF NOT EXISTS "navigation_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"from_page_id" uuid NOT NULL,
	"to_page_id" uuid,
	"from_route_pattern" varchar(300),
	"to_route_pattern" varchar(300),
	"to_url" text,
	"label" text,
	"action" varchar(24) NOT NULL DEFAULT 'navigate',
	"role" varchar(120),
	"is_new_page" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "navigation_edges_from_page_id_fkey" FOREIGN KEY ("from_page_id") REFERENCES "discovered_pages"("id") ON DELETE cascade,
	CONSTRAINT "navigation_edges_to_page_id_fkey" FOREIGN KEY ("to_page_id") REFERENCES "discovered_pages"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ui_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_session_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"route_pattern" varchar(300),
	"state_fingerprint" varchar(64) NOT NULL,
	"name" varchar(200),
	"trigger_label" text,
	"trigger_selector" text,
	"is_modal" boolean DEFAULT false NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ui_states_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "discovered_pages"("id") ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "ui_state_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "navigation_edges_session_idx" ON "navigation_edges" ("discovery_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "navigation_edges_module_idx" ON "navigation_edges" ("module_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "navigation_edges_from_idx" ON "navigation_edges" ("from_page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "navigation_edges_to_idx" ON "navigation_edges" ("to_page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_states_session_idx" ON "ui_states" ("discovery_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_states_module_idx" ON "ui_states" ("module_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_states_page_idx" ON "ui_states" ("page_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ui_states_page_fingerprint_unique" ON "ui_states" ("page_id", "state_fingerprint");
