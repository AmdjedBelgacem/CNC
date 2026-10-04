-- Feed: real votes, threaded comments, real tags.
-- Idempotent so it can be applied to databases that were schema-pushed.
--
-- NOTE ON STYLE: the migration runner splits this file on its own marker comment,
-- and a dollar-quoted DO block glued to the next statement fails to parse. So
-- every statement here is plain SQL, and idempotency comes from IF [NOT] EXISTS
-- plus DROP ... IF EXISTS rather than from procedural blocks. (For the same
-- reason, do not write the marker's text literally inside a comment here.)

-- ---------------------------------------------------------------------------
-- 1. Votes. `post_likes` predates downvotes, so it gains a direction column
--    rather than a second table: one row per (post, user) is the whole invariant.
-- ---------------------------------------------------------------------------
ALTER TABLE "post_likes" ADD COLUMN IF NOT EXISTS "value" smallint NOT NULL DEFAULT 1;
--> statement-breakpoint
-- A vote is either an upvote or a downvote, never anything else.
ALTER TABLE "post_likes" DROP CONSTRAINT IF EXISTS "post_likes_value_check";
--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_value_check" CHECK ("value" IN (-1, 1));
--> statement-breakpoint

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "downvote_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- score = upvotes - downvotes, denormalized so Hot/Top sorting stays one index scan.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "score" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Backfill the counters from the votes that already exist (all of them upvotes).
UPDATE "posts" p
SET "score" = COALESCE(v.up, 0) - COALESCE(v.down, 0),
    "downvote_count" = COALESCE(v.down, 0)
FROM (
  SELECT "post_id",
         COUNT(*) FILTER (WHERE "value" > 0)::int AS up,
         COUNT(*) FILTER (WHERE "value" < 0)::int AS down
  FROM "post_likes" GROUP BY "post_id"
) v
WHERE v."post_id" = p."id";
--> statement-breakpoint

-- Hot (score, then recency) and New (recency) sorting.
CREATE INDEX IF NOT EXISTS "posts_tenant_score_created_idx"
  ON "posts" ("tenant_id", "is_public", "score" DESC, "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_tenant_created_idx"
  ON "posts" ("tenant_id", "is_public", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_likes_post_value_idx" ON "post_likes" ("post_id", "value");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Comments: a real thread, votes, and soft delete.
--    Soft delete keeps replies in place; a hard delete would orphan a subtree.
-- ---------------------------------------------------------------------------
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "comments" ("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "depth" smallint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "score" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "is_removed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_depth_check";
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_depth_check" CHECK ("depth" >= 0 AND "depth" <= 8);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "comment_votes" (
  "comment_id" uuid NOT NULL REFERENCES "comments" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "value" smallint NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("comment_id", "user_id"),
  CONSTRAINT "comment_votes_value_check" CHECK ("value" IN (-1, 1))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_votes_comment_value_idx" ON "comment_votes" ("comment_id", "value");
--> statement-breakpoint
-- Thread reads: one post, ordered by score or time.
CREATE INDEX IF NOT EXISTS "comments_post_score_idx" ON "comments" ("post_id", "score" DESC, "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_post_parent_idx" ON "comments" ("post_id", "parent_id");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Tags, normalized. `posts.tags` was a free-text array nothing read; the
--    join table is what makes a tag index, a tag page and filtering possible.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
  "slug" varchar(60) NOT NULL,
  "label" varchar(60) NOT NULL,
  "description" varchar(280),
  "usage_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenant_slug_unique" ON "tags" ("tenant_id", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_tenant_usage_idx" ON "tags" ("tenant_id", "usage_count" DESC, "label");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "post_tags" (
  "post_id" uuid NOT NULL REFERENCES "posts" ("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags" ("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id", "tag_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_tags_tag_idx" ON "post_tags" ("tag_id");
--> statement-breakpoint

-- Backfill: promote every distinct tag already stored on a post. LATERAL keeps
-- the unnest dependency explicit (a comma-join cannot reference the earlier table).
INSERT INTO "tags" ("tenant_id", "slug", "label")
SELECT DISTINCT p."tenant_id", lower(btrim(t.tag)), initcap(replace(btrim(t.tag), '-', ' '))
FROM "posts" p
JOIN LATERAL unnest(p."tags") AS t(tag) ON true
WHERE t.tag IS NOT NULL AND length(btrim(t.tag)) > 0
ON CONFLICT ("tenant_id", "slug") DO NOTHING;
--> statement-breakpoint

INSERT INTO "post_tags" ("post_id", "tag_id")
SELECT p."id", tg."id"
FROM "posts" p
JOIN LATERAL unnest(p."tags") AS t(tag) ON true
JOIN "tags" tg ON tg."tenant_id" = p."tenant_id" AND tg."slug" = lower(btrim(t.tag))
ON CONFLICT DO NOTHING;
--> statement-breakpoint

UPDATE "tags" tg
SET "usage_count" = COALESCE(c.n, 0)
FROM (
  SELECT "tag_id", COUNT(*)::int AS n FROM "post_tags" GROUP BY "tag_id"
) c
WHERE c."tag_id" = tg."id";
