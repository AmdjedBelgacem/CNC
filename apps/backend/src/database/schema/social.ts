import { pgTable, uuid, varchar, text, boolean, integer, doublePrecision, jsonb, timestamp } from 'drizzle-orm/pg-core';
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

export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverUrl: varchar('cover_url', { length: 500 }),
  location: jsonb('location').$type<{ lat: number; lng: number; city: string; state: string }>(),
  memberCount: integer('member_count').default(0),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id).notNull(),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).default('member'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});
