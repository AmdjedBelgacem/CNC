import { pgTable, uuid, varchar, boolean, jsonb, timestamp, text, uniqueIndex, index, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  username: varchar('username', { length: 100 }),
  name: varchar('name', { length: 255 }),
  headline: varchar('headline', { length: 200 }),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  location: varchar('location', { length: 200 }),
  coverImageUrl: varchar('cover_image_url', { length: 500 }),
  portfolioEnabled: boolean('portfolio_enabled').default(true),
  language: varchar('language', { length: 10 }).default('en'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  role: varchar('role', { length: 50 }).default('student').notNull(),
  authProviderId: varchar('auth_provider_id', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  passwordChangedAt: timestamp('password_changed_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  isActive: boolean('is_active').default(true),
  accountStatus: varchar('account_status', { length: 50 }).default('pending_verification').notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  lockedUntil: timestamp('locked_until'),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedByUserId: uuid('deleted_by_user_id'),
  /**
   * Supabase Auth (auth.users) identifier, added by migration 032_supabase_auth_link.
   * Supabase is only the identity provider: this table stays the profile record, so
   * the 48 `user_id` foreign keys across the schema keep pointing at `users.id`.
   * NULL until the account is synced.
   */
  authUserId: uuid('auth_user_id'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  lastLoginUserAgent: text('last_login_user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantEmailIdx: uniqueIndex('tenant_email_idx').on(table.tenantId, table.email),
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

export const follows = pgTable('follows', {
  followerId: uuid('follower_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  followingId: uuid('following_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // One edge per pair. The service relies on this for an idempotent follow
  // (`onConflictDoNothing`) instead of a read-then-write race.
  followerFollowingUnique: uniqueIndex('follows_follower_following_unique').on(table.followerId, table.followingId),
  followerCreatedIdx: index('follows_follower_created_idx').on(table.followerId, table.createdAt),
  followingCreatedIdx: index('follows_following_created_idx').on(table.followingId, table.createdAt),
}));

export const userPortfolioItems = pgTable('user_portfolio_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  imageUrl: varchar('image_url', { length: 500 }),
  projectUrl: varchar('project_url', { length: 500 }),
  tags: varchar('tags').array(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
