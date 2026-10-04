import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  /**
   * `personal` is the recipient's own account activity. `platform` is a
   * cross-tenant operational signal addressed to super admins, filed under the
   * tenant that caused it — which is usually not the recipient's own tenant, so
   * the platform feed is selected by this column and not by `tenant_id`.
   */
  audience: varchar('audience', { length: 20 }).default('personal').notNull(),
  type: varchar('type', { length: 80 }).notNull(),
  category: varchar('category', { length: 50 }).default('system').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  href: varchar('href', { length: 1000 }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: varchar('entity_id', { length: 255 }),
  readAt: timestamp('read_at'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  data: jsonb('data').$type<Record<string, unknown>>(),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  dedupeKey: varchar('dedupe_key', { length: 255 }),
}, (table) => ({
  tenantUserCreatedIdx: index('notifications_tenant_user_created_idx').on(table.tenantId, table.userId, table.createdAt, table.id),
  userUnreadIdx: index('notifications_user_unread_idx')
    .on(table.userId, table.createdAt, table.id)
    .where(sql`${table.readAt} IS NULL`),
  userIsReadCreatedIdx: index('notifications_user_is_read_created_idx').on(table.userId, table.isRead, table.createdAt),
  idempotencyKeyUnique: uniqueIndex('notifications_tenant_user_idempotency_key_unique')
    .on(table.tenantId, table.userId, table.idempotencyKey)
    .where(sql`${table.idempotencyKey} IS NOT NULL`),
  dedupeKeyUnique: uniqueIndex('notifications_tenant_user_dedupe_key_unique')
    .on(table.tenantId, table.userId, table.dedupeKey)
    .where(sql`${table.dedupeKey} IS NOT NULL`),
  // `createdAt` is declared DESC to match migration 028 and the feed's
  // `ORDER BY created_at DESC`: a schema that disagrees with the database
  // would have the next generated migration try to rebuild the index and lose
  // the ordering the platform feed relies on.
  platformFeedIdx: index('notifications_platform_feed_idx')
    .on(table.userId, table.audience, table.createdAt.desc())
    .where(sql`${table.audience} = 'platform'`),
}));

/**
 * Per-super-admin toggles for platform-critical alerts.
 *
 * Separate from `user_preferences` on purpose: muting a platform alert must not
 * disturb, or be disturbed by, the same person's personal notifications.
 */
export const platformNotificationPrefs = pgTable('platform_notification_prefs', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  prefs: jsonb('prefs').$type<Record<string, boolean>>().default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
