ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "route_pattern" varchar(300);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "canonical_url" text;
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "page_fingerprint" varchar(64);
--> statement-breakpoint
ALTER TABLE "discovered_pages" ADD COLUMN IF NOT EXISTS "dom_fingerprint" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_pages_route_pattern_idx" ON "discovered_pages" ("module_id", "route_pattern");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_pages_canonical_url_idx" ON "discovered_pages" ("discovery_session_id", "canonical_url");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discovered_pages_session_route_pattern_unique" ON "discovered_pages" ("discovery_session_id", "module_id", "route_pattern", "page_fingerprint");
