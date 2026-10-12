-- Reconcile study group member counts with reality.
--
-- The seed that created these groups wrote a hardcoded `member_count` (18, 22, 33 …) and never
-- inserted a single `group_members` row, so the number shown on every group card was fiction. It
-- was harmless while joining was unimplemented; now that `POST /:id/join` recomputes the counter
-- from real rows, the first person to join any group would have watched it collapse from 18 to 2.
--
-- Two things happen here, both idempotent:
--
--   1. Each group's host gets an explicit membership row. The host is a member of their own group
--      by construction — `POST /social/groups` inserts exactly this row for new groups — so
--      backfilling it brings existing rows in line with what creation produces, and it is the only
--      membership we can assert truthfully. No other user is invented: a seeded membership for
--      someone who never joined would put a group they never joined into their "My groups" list.
--
--   2. `member_count` is recomputed from `group_members` for every group. This is the same
--      operation the service performs on join/leave, applied once to the pre-existing data.
--
-- The counts go down. They have to: the old values counted people who were never recorded as
-- members, and a number that cannot be backed by a row is exactly what this migration removes.

INSERT INTO "group_members" ("group_id", "user_id", "role", "joined_at")
SELECT g."id", g."host_id", 'host', COALESCE(g."created_at", NOW())
FROM "study_groups" g
WHERE g."host_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = g."host_id")
  AND NOT EXISTS (
    SELECT 1 FROM "group_members" gm
    WHERE gm."group_id" = g."id" AND gm."user_id" = g."host_id"
  );

UPDATE "study_groups" g
SET "member_count" = COALESCE(c."n", 0)
FROM (
  SELECT "group_id", COUNT(*) AS "n"
  FROM "group_members"
  GROUP BY "group_id"
) c
WHERE c."group_id" = g."id"
  AND g."member_count" IS DISTINCT FROM c."n";

-- Groups that ended up with no memberships at all (host row missing because the user is gone)
-- must not keep a stale non-zero count either.
UPDATE "study_groups" g
SET "member_count" = 0
WHERE g."member_count" <> 0
  AND NOT EXISTS (SELECT 1 FROM "group_members" gm WHERE gm."group_id" = g."id");
