-- Migration: RBAC — custom roles & permissions
-- Hand-written and idempotent (IF NOT EXISTS) to avoid conflicting with the
-- ad-hoc portfolio/builder migrations that are not tracked in the journal.

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(120) NOT NULL,
  "group" varchar(60) NOT NULL,
  "label" varchar(160),
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_idx" ON "permissions" ("key");
CREATE INDEX IF NOT EXISTS "permissions_group_idx" ON "permissions" ("group");

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(80) NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_key_idx" ON "roles" ("tenant_id","key");
CREATE INDEX IF NOT EXISTS "roles_tenant_idx" ON "roles" ("tenant_id");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_perm_idx" ON "role_permissions" ("role_id","permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" ("role_id");
CREATE INDEX IF NOT EXISTS "role_permissions_perm_idx" ON "role_permissions" ("permission_id");

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "assigned_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users" ("id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_tenant_role_idx" ON "user_roles" ("user_id","tenant_id","role_id");
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS "user_roles_tenant_idx" ON "user_roles" ("tenant_id");
CREATE INDEX IF NOT EXISTS "user_roles_role_idx" ON "user_roles" ("role_id");
