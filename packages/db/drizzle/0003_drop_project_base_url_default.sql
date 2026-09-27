-- Align the live `projects` columns with the Drizzle schema: 0002 backfilled
-- `base_url` with a placeholder default so the NOT NULL constraint could be
-- added to existing rows. Now that every project supplies its own base URL
-- through the API, drop the placeholder so the database enforces the same
-- contract as the application layer.
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "base_url" DROP DEFAULT;
