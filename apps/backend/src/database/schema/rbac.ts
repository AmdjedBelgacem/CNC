import { pgTable, uuid, varchar, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

/**
 * Global permission catalog. Keys are canonical (e.g. `staff:invite`).
 * Legacy keys from the previous ROLE_PERMISSIONS map are also registered here
 * so nothing reading them breaks during the transition.
 */
export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 120 }).notNull().unique(),
  group: varchar('group', { length: 60 }).notNull(),
  label: varchar('label', { length: 160 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('permissions_group_idx').on(table.group),
}));

/** Tenant-scoped roles. System roles (super_admin, admin, ...) are protected. */
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  key: varchar('key', { length: 80 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantKeyIdx: uniqueIndex('roles_tenant_key_idx').on(table.tenantId, table.key),
  tenantIdx: index('roles_tenant_idx').on(table.tenantId),
}));

/** Many-to-many role <-> permission. */
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  rolePermIdx: uniqueIndex('role_permissions_role_perm_idx').on(table.roleId, table.permissionId),
  roleIdx: index('role_permissions_role_idx').on(table.roleId),
  permIdx: index('role_permissions_perm_idx').on(table.permissionId),
}));

/** Tenant-scoped user -> role assignment (replaces the fixed users.role for fine-grained auth). */
export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTenantRoleIdx: uniqueIndex('user_roles_user_tenant_role_idx').on(table.userId, table.tenantId, table.roleId),
  userIdx: index('user_roles_user_idx').on(table.userId),
  tenantIdx: index('user_roles_tenant_idx').on(table.tenantId),
  roleIdx: index('user_roles_role_idx').on(table.roleId),
}));
