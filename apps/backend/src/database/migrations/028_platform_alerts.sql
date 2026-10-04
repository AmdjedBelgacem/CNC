-- 028_platform_alerts.sql
--
-- Platform-critical alerting for super admins, kept separate from the personal
-- notification feed.
--
-- A `super_admin` is an ordinary user row inside one tenant, so their personal
-- feed and their platform feed are the same table. The two are separated by a
-- new `audience` column rather than by tenant: a platform alert is filed under
-- the tenant that *caused* it, which is frequently not the super admin's own
-- tenant, so tenant-based filtering cannot express "everything critical on the
-- platform".
--
-- Additive and backfill-safe: a new column with a default, a new table, and new
-- indexes. No existing row changes meaning, and `audience = 'personal'` is
-- exactly the previous behaviour.

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "audience" varchar(20) DEFAULT 'personal' NOT NULL;

-- Backfill defensively: any row written before the column existed is personal.
UPDATE "notifications" SET "audience" = 'personal' WHERE "audience" IS DISTINCT FROM 'personal';

-- Platform feed: newest first, per recipient, across every tenant.
CREATE INDEX IF NOT EXISTS "notifications_platform_feed_idx"
  ON "notifications" USING btree ("user_id","audience","created_at" DESC)
  WHERE "audience" = 'platform';

-- Super-admin alert preferences, deliberately a separate table from
-- `user_preferences`. Muting a platform alert must not touch, and must not be
-- affected by, the same person's personal notification settings.
CREATE TABLE IF NOT EXISTS "platform_notification_prefs" (
  "user_id" uuid PRIMARY KEY REFERENCES "public"."users"("id") ON DELETE cascade,
  "prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

COMMENT ON COLUMN "notifications"."audience" IS
  'personal = the recipient''s own account activity; platform = cross-tenant operational signal addressed to super admins.';
COMMENT ON TABLE "platform_notification_prefs" IS
  'Per-super-admin toggles for platform-critical alerts, independent of personal notification preferences.';
