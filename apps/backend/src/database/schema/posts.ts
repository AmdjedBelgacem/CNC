import { pgTable, uuid, varchar, text, boolean, integer, smallint, timestamp, jsonb, primaryKey, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  mediaUrls: jsonb('media_urls').$type<string[]>(),
  /**
   * Historical free-text tags. Superseded by the `post_tags` join, which is the
   * only tag source the application reads; kept for the backfill in migration 019.
   */
  tags: varchar('tags').array(),
  isPublic: boolean('is_public').default(true),
  /** Upvotes only. `score` is upvotes minus downvotes. */
  likeCount: integer('like_count').default(0).notNull(),
  downvoteCount: integer('downvote_count').default(0).notNull(),
  /** Denormalized so Hot/Top sorting is a single index scan. */
  score: integer('score').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantScoreIdx: index('posts_tenant_score_created_idx').on(table.tenantId, table.isPublic, table.score, table.createdAt),
  tenantCreatedIdx: index('posts_tenant_created_idx').on(table.tenantId, table.isPublic, table.createdAt),
}));

/**
 * One row per (post, user): a member can hold exactly one vote of one direction.
 * The table name predates downvotes, hence the value column.
 */
export const postVotes = pgTable('post_likes', {
  postId: uuid('post_id').references(() => posts.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  /** 1 = upvote, -1 = downvote. */
  value: smallint('value').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.userId] }),
  postValueIdx: index('post_likes_post_value_idx').on(table.postId, table.value),
  valueCheck: check('post_likes_value_check', sql`${table.value} IN (-1, 1)`),
}));

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  /** Null for a top-level comment. ON DELETE CASCADE clears a pruned subtree. */
  parentId: uuid('parent_id'),
  /** Denormalized reply depth, capped by `comments_depth_check`. */
  depth: smallint('depth').default(0).notNull(),
  score: integer('score').default(0).notNull(),
  /**
   * Soft delete: the row stays so replies keep their place, but the body is
   * hidden and the author is not named.
   */
  isRemoved: boolean('is_removed').default(false).notNull(),
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  postScoreIdx: index('comments_post_score_idx').on(table.postId, table.score, table.createdAt),
  postParentIdx: index('comments_post_parent_idx').on(table.postId, table.parentId),
  depthCheck: check('comments_depth_check', sql`${table.depth} >= 0 AND ${table.depth} <= 8`),
}));

export const commentVotes = pgTable('comment_votes', {
  commentId: uuid('comment_id').references(() => comments.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  value: smallint('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId] }),
  commentValueIdx: index('comment_votes_comment_value_idx').on(table.commentId, table.value),
  valueCheck: check('comment_votes_value_check', sql`${table.value} IN (-1, 1)`),
}));

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  slug: varchar('slug', { length: 60 }).notNull(),
  label: varchar('label', { length: 60 }).notNull(),
  description: varchar('description', { length: 280 }),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantSlugUnique: uniqueIndex('tags_tenant_slug_unique').on(table.tenantId, table.slug),
  tenantUsageIdx: index('tags_tenant_usage_idx').on(table.tenantId, table.usageCount, table.label),
}));

export const postTags = pgTable('post_tags', {
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
  tagIdx: index('post_tags_tag_idx').on(table.tagId),
}));
