-- Study group membership: point group_members at the table the site actually uses.
--
-- `group_members.group_id` referenced `groups`, a second, orphaned groups table that no code
-- reads, so a membership could never be attached to a `study_groups` row — the kind the /groups
-- route lists. `user_id` had no foreign key at all and accepted any uuid. Joining a group was
-- therefore not merely unimplemented, it was unimplementable.
--
-- Both tables are empty in production, so there is no data to migrate and nothing to preserve.
-- The deletes below are belt-and-braces for any environment that does have rows: they must run
-- before the new foreign keys or the ALTER would fail on the orphans.

-- 1. Drop the reference to the orphaned table, then remove any membership that cannot be
--    represented under the corrected schema.
ALTER TABLE "group_members" DROP CONSTRAINT IF EXISTS "group_members_group_id_groups_id_fk";

DELETE FROM "group_members"
WHERE "group_id" NOT IN (SELECT "id" FROM "study_groups");

DELETE FROM "group_members"
WHERE "user_id" NOT IN (SELECT "id" FROM "users");

-- 2. Collapse duplicates, which the new unique index would otherwise reject. Newest wins so a
--    re-join keeps the most recent role and joined_at rather than an arbitrary one.
DELETE FROM "group_members" a
USING "group_members" b
WHERE a."group_id" = b."group_id"
  AND a."user_id" = b."user_id"
  AND (a."joined_at", a."id") < (b."joined_at", b."id");

-- 3. Repoint both foreign keys. CASCADE matters: deleting a group must take its memberships with
--    it, and deleting a user must not leave rows pointing at nobody.
ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_group_id_study_groups_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- 4. One membership per person per group. Without this, two concurrent join requests both pass
--    the "already a member?" check and both insert, double-counting against max_members.
CREATE UNIQUE INDEX "group_members_group_user_uniq"
  ON "group_members" USING btree ("group_id","user_id");

CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");

-- 5. The list endpoint filters by active/academy/city and orders by member count; without these
--    every request is a sequential scan.
CREATE INDEX "study_groups_member_count_idx" ON "study_groups" USING btree ("member_count");
CREATE INDEX "study_groups_academy_idx" ON "study_groups" USING btree ("academy");
CREATE INDEX "study_groups_city_idx" ON "study_groups" USING btree ("city");
CREATE INDEX "study_groups_is_active_idx" ON "study_groups" USING btree ("is_active");

-- 6. The orphaned table itself. Its only referrer was the foreign key dropped in step 1, and no
--    code has ever read it. Left in place it is a trap: the next person to write "groups" reaches
--    for it and writes memberships that the site will never show.
DROP TABLE IF EXISTS "groups";
