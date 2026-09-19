import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  deviceInfo: text('device_info'),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.userId),
  tokenHashIdx: uniqueIndex('refresh_tokens_hash_idx').on(table.tokenHash),
}));

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('verification_tokens_hash_idx').on(table.tokenHash),
  userIdx: index('verification_tokens_user_idx').on(table.userId),
}));

export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  providerEmail: varchar('provider_email', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  providerIdx: uniqueIndex('oauth_provider_account_idx').on(table.provider, table.providerAccountId),
  userIdx: index('oauth_accounts_user_idx').on(table.userId),
}));

export const twoFactorSecrets = pgTable('two_factor_secrets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  secret: varchar('secret', { length: 255 }).notNull(),
  backupCodes: jsonb('backup_codes').$type<string[]>().notNull().default([]),
  enabledAt: timestamp('enabled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  deviceInfo: text('device_info'),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('user_sessions_user_idx').on(table.userId),
  tokenHashIdx: uniqueIndex('user_sessions_hash_idx').on(table.tokenHash),
}));

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: varchar('entity_id', { length: 255 }),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('audit_logs_user_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  tenantIdx: index('audit_logs_tenant_idx').on(table.tenantId),
}));

export const failedLoginAttempts = pgTable('failed_login_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  ip: varchar('ip', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
}, (table) => ({
  emailIpIdx: index('failed_login_email_ip_idx').on(table.email, table.ip),
  emailIdx: index('failed_login_email_idx').on(table.email),
  attemptedAtIdx: index('failed_login_attempted_at_idx').on(table.attemptedAt),
}));

export const userTenantRoles = pgTable('user_tenant_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTenantRoleIdx: uniqueIndex('user_tenant_role_idx').on(table.userId, table.tenantId, table.role),
  userIdx: index('user_tenant_roles_user_idx').on(table.userId),
  tenantIdx: index('user_tenant_roles_tenant_idx').on(table.tenantId),
}));

export const signingKeys = pgTable('signing_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyId: varchar('key_id', { length: 64 }).notNull().unique(),
  secret: varchar('secret', { length: 512 }).notNull(),
  algorithm: varchar('algorithm', { length: 20 }).default('HS256').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  rotatedAt: timestamp('rotated_at'),
}, (table) => ({
  keyIdIdx: uniqueIndex('signing_keys_key_id_idx').on(table.keyId),
  activeIdx: index('signing_keys_active_idx').on(table.isActive),
}));

export const impersonationSessions = pgTable('impersonation_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminUserId: uuid('admin_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  adminRefreshEncrypted: text('admin_refresh_encrypted'),
  adminAccessTokenHash: varchar('admin_access_token_hash', { length: 255 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  adminIdx: index('impersonation_admin_idx').on(table.adminUserId),
  targetIdx: index('impersonation_target_idx').on(table.targetUserId),
  expiresIdx: index('impersonation_expires_idx').on(table.expiresAt),
}));
