import { pgTable, uuid, varchar, text, boolean, integer, doublePrecision, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const repairShops = pgTable('repair_shops', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  address: varchar('address', { length: 500 }).notNull(),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 500 }),
  email: varchar('email', { length: 255 }),
  specialties: varchar('specialties').array(),
  servicesOffered: jsonb('services_offered').$type<string[]>(),
  businessHours: jsonb('business_hours').$type<Record<string, string>>(),
  rating: integer('rating'),
  reviewCount: integer('review_count').default(0),
  isVerified: boolean('is_verified').default(false),
  isActive: boolean('is_active').default(true),
  logoUrl: varchar('logo_url', { length: 500 }),
  photoUrls: jsonb('photo_urls').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * The orphaned second groups table that used to live here is gone. Its only referrer was
 * `group_members.group_id`, which pointed at it instead of `study_groups`, and no code ever read
 * it — the /groups route reads `study_groups`. The table itself was dropped in
 * `038_study_group_membership.sql`. Re-declaring it would make `drizzle-kit push` silently
 * recreate a table nothing uses, putting the trap back exactly where it was.
 */
export const studyGroups = pgTable('study_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  hostId: uuid('host_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  academy: varchar('academy', { length: 100 }),
  address: varchar('address', { length: 500 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  meetingSchedule: varchar('meeting_schedule', { length: 200 }),
  maxMembers: integer('max_members').default(20),
  memberCount: integer('member_count').default(1),
  coverUrl: varchar('cover_url', { length: 500 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // The list is ordered by member count and filtered by academy/city. Without these every
  // request is a sequential scan of the whole table.
  index('study_groups_member_count_idx').on(table.memberCount),
  index('study_groups_academy_idx').on(table.academy),
  index('study_groups_city_idx').on(table.city),
  index('study_groups_is_active_idx').on(table.isActive),
]);

/**
 * Membership of a study group.
 *
 * `groupId` pointed at the orphaned `groups` table rather than `study_groups`, so a membership
 * could never be attached to a group the site actually shows, and `userId` had no foreign key at
 * all — it accepted any uuid, including users who do not exist. Joining a group was therefore not
 * merely unimplemented, it was unimplementable.
 *
 * The composite unique is what makes joining idempotent-safe: without it, two concurrent join
 * requests both pass the "is this person already a member?" check and insert.
 */
export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => studyGroups.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).default('member'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('group_members_group_user_uniq').on(table.groupId, table.userId),
  index('group_members_user_idx').on(table.userId),
]);
