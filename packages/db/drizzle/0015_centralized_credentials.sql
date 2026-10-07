-- Centralized, project-level credentials and roles.
--
-- A credential used to belong to exactly one module. It now belongs to the
-- project and modules reference it through `module_credentials`, so one login is
-- created once and reused everywhere.
--
-- Nothing is re-encrypted. A secret is encrypted with a key derived from a scope
-- string; existing rows keep their module id as `encryption_scope`, new rows use
-- the project id. `module_id` is kept (nullable, no longer an owner) so the old
-- column can be dropped in a later release once nothing reads it.
CREATE TABLE IF NOT EXISTS "project_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_roles_project_name_idx" ON "project_roles" ("project_id", "name");
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "name" varchar(120);
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "environment_id" uuid REFERENCES "environments"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "variables" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "encryption_scope" varchar(64);
--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "module_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "credentials" DROP CONSTRAINT IF EXISTS "credentials_module_id_modules_id_fk";
--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_module_id_modules_id_fk"
  FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "credentials_module_role_unique";
--> statement-breakpoint
UPDATE "credentials" AS c SET "project_id" = m."project_id"
FROM "modules" AS m
WHERE c."module_id" = m."id" AND c."project_id" IS NULL;
--> statement-breakpoint
UPDATE "credentials" SET "encryption_scope" = "module_id"::text WHERE "encryption_scope" IS NULL;
--> statement-breakpoint
-- Name defaults to the role. Two modules of one project may each have had an
-- "admin" credential; those are disambiguated by module name, never merged,
-- because their secrets cannot be compared without decrypting them.
UPDATE "credentials" AS c SET "name" = named."name"
FROM (
  SELECT c2."id",
    CASE WHEN count(*) OVER (PARTITION BY c2."project_id", c2."role") > 1
      THEN left(c2."role" || ' (' || m."name" || ')', 120)
      ELSE c2."role"
    END AS "name"
  FROM "credentials" AS c2
  JOIN "modules" AS m ON m."id" = c2."module_id"
) AS named
WHERE c."id" = named."id" AND c."name" IS NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "encryption_scope" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credentials_project_id_idx" ON "credentials" ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credentials_project_name_idx" ON "credentials" ("project_id", "name");
--> statement-breakpoint
INSERT INTO "project_roles" ("project_id", "name")
SELECT DISTINCT "project_id", "role" FROM "credentials"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "module_credentials" (
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "credential_id" uuid NOT NULL REFERENCES "credentials"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("module_id", "credential_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_credentials_credential_id_idx" ON "module_credentials" ("credential_id");
--> statement-breakpoint
INSERT INTO "module_credentials" ("module_id", "credential_id")
SELECT "module_id", "id" FROM "credentials" WHERE "module_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Ownership has moved to the project. Clearing the legacy owner stops a module
-- deletion from cascading into a credential other modules now share.
UPDATE "credentials" SET "module_id" = NULL WHERE "module_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "require_approval" boolean DEFAULT false NOT NULL;
