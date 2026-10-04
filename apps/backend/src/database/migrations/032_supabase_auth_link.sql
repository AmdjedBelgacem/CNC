-- 032: Phase 2 groundwork — link the application `users` row to a Supabase Auth user.
--
-- Tenancy, RBAC, sessions and profile data all stay exactly where they are: this
-- table remains the profile record, and the 48 existing `user_id` foreign keys keep
-- pointing at `users.id`. Supabase Auth is used purely as the identity provider, so
-- no foreign key is rewritten.
--
-- `auth_user_id` is deliberately NULLABLE and has no default: until a user is synced
-- to auth.users there is nothing to point at, and a NOT NULL column would make this
-- migration fail on any existing row.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_user_id" uuid;

-- One Supabase identity per application user. Partial, because NULLs (unsynced users)
-- would otherwise collide in a plain unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "users_auth_user_id_unique"
  ON "users" ("auth_user_id") WHERE "auth_user_id" IS NOT NULL;

-- Supports the admin "find by Supabase identity" lookup and the sync script's
-- idempotency check.
CREATE INDEX IF NOT EXISTS "users_auth_user_id_idx"
  ON "users" ("auth_user_id") WHERE "auth_user_id" IS NOT NULL;

COMMENT ON COLUMN "users"."auth_user_id" IS
  'Supabase Auth (auth.users) identifier. NULL until the account is synced to Supabase Auth.';