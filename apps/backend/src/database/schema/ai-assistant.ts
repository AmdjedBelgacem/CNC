import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

/** Where a conversation was started from. Drives the history badge + prompt mode. */
export const aiConversationSources = ['general', 'lesson', 'post', 'admin_test'] as const;
export type AiConversationSource = (typeof aiConversationSources)[number];

export const aiConversationStatuses = ['active', 'archived'] as const;
export type AiConversationStatus = (typeof aiConversationStatuses)[number];

/**
 * A reference the conversation is grounded in (a post, a lesson, a page).
 * Stored as jsonb: the shape is intentionally open so a new surface can be
 * grounded without a migration. It is always treated as untrusted DATA.
 */
export type AiSourceRef = {
  type: 'post' | 'lesson' | 'page' | 'product' | string;
  id: string;
  href?: string | null;
  title?: string | null;
  author?: string | null;
  excerpt?: string | null;
};

export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }),
  source: varchar('source', { length: 32 }).default('general').notNull(),
  sourceRef: jsonb('source_ref').$type<AiSourceRef | null>(),
  status: varchar('status', { length: 16 }).default('active').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // The history list is always "mine, newest activity first".
  userLastMessageIdx: index('ai_conversations_user_last_message_idx').on(table.userId, table.lastMessageAt),
  tenantIdx: index('ai_conversations_tenant_idx').on(table.tenantId),
  statusIdx: index('ai_conversations_status_idx').on(table.status),
}));

export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').$type<unknown[]>(),
  /**
   * Which prompt generation produced this answer. Without it, an eval run and a
   * live answer cannot be compared and a prompt edit is unfalsifiable.
   */
  promptVersion: varchar('prompt_version', { length: 40 }).default('v1').notNull(),
  /** Model, latency, mode. Never credentials. */
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationCreatedIdx: index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  tenantIdx: index('ai_messages_tenant_idx').on(table.tenantId),
}));

export type AiConversationRow = typeof aiConversations.$inferSelect;
export type AiMessageRow = typeof aiMessages.$inferSelect;
