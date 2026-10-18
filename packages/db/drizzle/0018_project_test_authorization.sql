-- Explicit authorization to test the target site.
--
-- Discovery and test runs drive a real browser against someone's website, so
-- they are refused until a user confirms they are permitted to test it. The
-- confirmation records who and when, and the sites (host[:port]) it covers:
-- pointing a project or environment at another host needs a new confirmation.
-- Existing projects are deliberately not backfilled; nobody attested for them.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "authorization_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "authorization_confirmed_by" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "authorized_hosts" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_authorization_confirmed_by_users_id_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_authorization_confirmed_by_users_id_fk"
      FOREIGN KEY ("authorization_confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
