-- Follow edges must be unique. Without this, two concurrent follows can insert
-- the same pair and the follower count double-counts.
DELETE FROM "follows" WHERE ctid NOT IN (
  SELECT min(ctid) FROM "follows" GROUP BY "follower_id", "following_id"
);
--> statement-breakpoint
DELETE FROM "follows" WHERE "follower_id" = "following_id";
--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_following_unique" UNIQUE ("follower_id", "following_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follows_following_created_idx" ON "follows" ("following_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follows_follower_created_idx" ON "follows" ("follower_id", "created_at" DESC);
