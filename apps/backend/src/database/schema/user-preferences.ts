import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import type { ThemeTokens } from '@titan/shared';

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  theme: varchar('theme', { length: 20 }).default('system'),
  density: varchar('density', { length: 20 }).default('comfortable'),
  profileVisibility: varchar('profile_visibility', { length: 20 }).default('public'),
  whoCanMessage: varchar('who_can_message', { length: 20 }).default('everyone'),
  whoCanFollow: varchar('who_can_follow', { length: 20 }).default('everyone'),
  emailNotifications: jsonb('email_notifications').$type<Record<string, boolean>>().default({
    courseUpdates: true,
    recommendations: true,
    promotions: false,
    securityAlerts: true,
    orders: true,
    directMessages: false,
  }),
  inAppNotifications: jsonb('in_app_notifications').$type<Record<string, boolean>>().default({
    likes: true,
    comments: true,
    follows: true,
    courseUpdates: true,
    mentions: true,
    orders: true,
    completions: true,
    certificates: true,
    directMessages: true,
  }),
  /** Per-user design tokens (colors, fonts, radius). Null = inherit the tenant theme. */
  themeTokens: jsonb('theme_tokens').$type<ThemeTokens>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
