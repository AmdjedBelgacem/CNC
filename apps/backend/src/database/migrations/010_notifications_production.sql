ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenant_id" uuid;
UPDATE "notifications" AS n
SET "tenant_id" = u."tenant_id"
FROM "users" AS u
WHERE n."user_id" = u."id" AND n."tenant_id" IS NULL;
DELETE FROM "notifications" AS n
WHERE n."tenant_id" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "category" varchar(50) DEFAULT 'system' NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "href" varchar(1000);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_type" varchar(100);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_id" varchar(255);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" timestamp;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "meta" jsonb;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar(255);
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE varchar(80);
UPDATE "notifications" SET "category" = CASE
  WHEN "type" IN ('like', 'comment', 'follow', 'mention') THEN 'social'
  WHEN "type" IN ('enrollment', 'course_completed', 'certificate_issued') THEN 'learning'
  WHEN "type" IN ('order_created', 'order_confirmed', 'payment_failed', 'order_expired') THEN 'commerce'
  WHEN "type" IN ('dm_message', 'direct_message') THEN 'messages'
  ELSE "category"
END
WHERE "category" IS NULL OR "category" = 'system';
UPDATE "notifications" SET "read_at" = "created_at" WHERE "is_read" = true AND "read_at" IS NULL;
UPDATE "notifications" SET "is_read" = false WHERE "is_read" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "is_read" SET DEFAULT false;
ALTER TABLE "notifications" ALTER COLUMN "is_read" SET NOT NULL;
UPDATE "notifications" SET "meta" = "data" WHERE "meta" IS NULL AND "data" IS NOT NULL;
UPDATE "notifications" SET "href" = LEFT(COALESCE("data"->>'href', "data"->>'url'), 1000) WHERE "href" IS NULL AND "data" IS NOT NULL;
UPDATE "notifications" SET "entity_type" = LEFT("data"->>'entityType', 100) WHERE "entity_type" IS NULL AND "data"->>'entityType' IS NOT NULL;
UPDATE "notifications" SET "entity_id" = LEFT("data"->>'entityId', 255) WHERE "entity_id" IS NULL AND "data"->>'entityId' IS NOT NULL;
UPDATE "notifications" AS n SET "actor_id" = u."id"
FROM "users" AS u
WHERE n."actor_id" IS NULL AND n."tenant_id" = u."tenant_id" AND n."data"->>'actorId' = u."id"::text;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_users_id_fk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_tenant_id_tenants_id_fk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_actor_id_users_id_fk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "notifications_tenant_user_created_idx" ON "notifications" USING btree ("tenant_id", "user_id", "created_at", "id");
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications" USING btree ("user_id", "created_at", "id") WHERE "read_at" IS NULL;
CREATE INDEX IF NOT EXISTS "notifications_user_is_read_created_idx" ON "notifications" USING btree ("user_id", "is_read", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_tenant_user_idempotency_key_unique" ON "notifications" USING btree ("tenant_id", "user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_tenant_user_dedupe_key_unique" ON "notifications" USING btree ("tenant_id", "user_id", "dedupe_key") WHERE "dedupe_key" IS NOT NULL;
