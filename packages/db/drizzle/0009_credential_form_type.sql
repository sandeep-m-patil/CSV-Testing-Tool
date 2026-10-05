ALTER TABLE "credentials" ADD COLUMN IF NOT EXISTS "form_type" varchar(16) DEFAULT 'login' NOT NULL;
