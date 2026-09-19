import { pgTable, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const dmConversations = pgTable('dm_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantUpdatedIdx: index('dm_conversations_tenant_updated_idx').on(table.tenantId, table.updatedAt),
}));

export const dmParticipants = pgTable('dm_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => dmConversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastReadMessageId: uuid('last_read_message_id'),
}, (table) => ({
  convUserUnique: uniqueIndex('dm_participants_conv_user_unique').on(table.conversationId, table.userId),
  userIdx: index('dm_participants_user_idx').on(table.userId),
  tenantIdx: index('dm_participants_tenant_idx').on(table.tenantId),
}));

export const dmMessages = pgTable('dm_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => dmConversations.id, { onDelete: 'cascade' }).notNull(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  convCreatedIdx: index('dm_messages_conv_created_idx').on(table.conversationId, table.createdAt),
  tenantIdx: index('dm_messages_tenant_idx').on(table.tenantId),
}));

export const userBlocks = pgTable('user_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  blockerId: uuid('blocker_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  blockedId: uuid('blocked_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  blockerBlockedTenantUnique: uniqueIndex('user_blocks_blocker_blocked_tenant_unique').on(table.blockerId, table.blockedId, table.tenantId),
  blockedIdx: index('user_blocks_blocked_idx').on(table.blockedId),
}));
