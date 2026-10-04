import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export type AiAudience = 'public' | 'free-preview' | 'enrolled' | 'admin';
export type AiProviderName = 'openai-compatible';

export interface AiPermissionMetadata {
  courseId?: string;
  lessonId?: string;
  accessMode?: string;
  freePreview?: boolean;
  bodyIncluded?: boolean;
  enrollmentRequired?: boolean;
  pageVersion?: number;
}

export const aiProviderConfigs = pgTable(
  'ai_provider_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    provider: varchar('provider', { length: 64 }).$type<AiProviderName>().default('openai-compatible').notNull(),
    baseUrl: varchar('base_url', { length: 500 }).default('https://api.openai.com/v1').notNull(),
    encryptedApiKey: text('encrypted_api_key'),
    apiKeyVersion: integer('api_key_version').default(1).notNull(),
    primaryModel: varchar('primary_model', { length: 200 }).default('gpt-4o-mini').notNull(),
    fallbackModel: varchar('fallback_model', { length: 200 }),
    enabled: boolean('enabled').default(false).notNull(),
    publicEnabled: boolean('public_enabled').default(false).notNull(),
    retrievalTopK: integer('retrieval_top_k').default(8).notNull(),
    retrievalMinScore: real('retrieval_min_score').default(0.2).notNull(),
    maxContextChars: integer('max_context_chars').default(12000).notNull(),
    systemStyle: text('system_style'),
    timeoutMs: integer('timeout_ms').default(15000).notNull(),
    maxTokens: integer('max_tokens').default(800).notNull(),
    temperature: real('temperature').default(0.2).notNull(),
    embeddingModel: varchar('embedding_model', { length: 200 }),
    embeddingBaseUrl: varchar('embedding_base_url', { length: 500 }),
    status: varchar('status', { length: 30 }).default('disabled').notNull(),
    lastTestedAt: timestamp('last_tested_at'),
    lastErrorCode: varchar('last_error_code', { length: 80 }),
    lastIndexedAt: timestamp('last_indexed_at'),
    lastIndexDocuments: integer('last_index_documents').default(0).notNull(),
    lastIndexChunks: integer('last_index_chunks').default(0).notNull(),
    lastIndexEmbeddedChunks: integer('last_index_embedded_chunks').default(0).notNull(),
    lastIndexError: varchar('last_index_error', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantUnique: uniqueIndex('ai_provider_configs_tenant_unique').on(table.tenantId),
    statusIdx: index('ai_provider_configs_status_idx').on(table.tenantId, table.status),
  }),
);

export const aiDocuments = pgTable(
  'ai_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    href: varchar('href', { length: 1000 }).notNull(),
    content: text('content').notNull(),
    audience: varchar('audience', { length: 20 }).$type<AiAudience>().default('public').notNull(),
    courseId: uuid('course_id'),
    lessonId: uuid('lesson_id'),
    permissionMetadata: jsonb('permission_metadata').$type<AiPermissionMetadata>().default({}).notNull(),
    sourceUpdatedAt: timestamp('source_updated_at').defaultNow().notNull(),
    contentHash: varchar('content_hash', { length: 128 }).notNull(),
    status: varchar('status', { length: 30 }).default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceUnique: uniqueIndex('ai_documents_tenant_source_unique').on(table.tenantId, table.sourceType, table.sourceId),
    tenantStatusIdx: index('ai_documents_tenant_status_idx').on(table.tenantId, table.status),
    permissionIdx: index('ai_documents_permission_idx').on(table.tenantId, table.audience, table.courseId),
    sourceUpdatedIdx: index('ai_documents_source_updated_idx').on(table.tenantId, table.sourceUpdatedAt),
  }),
);

export const aiDocumentChunks = pgTable(
  'ai_document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    documentId: uuid('document_id').references(() => aiDocuments.id, { onDelete: 'cascade' }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    audience: varchar('audience', { length: 20 }).$type<AiAudience>().default('public').notNull(),
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    href: varchar('href', { length: 1000 }).notNull(),
    courseId: uuid('course_id'),
    lessonId: uuid('lesson_id'),
    permissionMetadata: jsonb('permission_metadata').$type<AiPermissionMetadata>().default({}).notNull(),
    sourceUpdatedAt: timestamp('source_updated_at').defaultNow().notNull(),
    embedding: jsonb('embedding').$type<number[]>(),
    embeddingModel: varchar('embedding_model', { length: 200 }),
    embeddingUpdatedAt: timestamp('embedding_updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    documentChunkUnique: uniqueIndex('ai_document_chunks_document_index_unique').on(table.documentId, table.chunkIndex),
    tenantAudienceIdx: index('ai_document_chunks_tenant_audience_idx').on(table.tenantId, table.audience),
    tenantCourseIdx: index('ai_document_chunks_tenant_course_idx').on(table.tenantId, table.courseId),
    embeddingIdx: index('ai_document_chunks_embedding_idx').on(table.tenantId, table.embeddingModel),
  }),
);

export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    requestId: varchar('request_id', { length: 100 }).notNull(),
    operation: varchar('operation', { length: 50 }).notNull(),
    provider: varchar('provider', { length: 64 }),
    model: varchar('model', { length: 200 }),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    retrievedChunkIds: jsonb('retrieved_chunk_ids').$type<string[]>().default([]).notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    errorCode: varchar('error_code', { length: 80 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index('ai_usage_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
    userCreatedIdx: index('ai_usage_logs_user_created_idx').on(table.userId, table.createdAt),
    statusIdx: index('ai_usage_logs_status_idx').on(table.tenantId, table.status),
  }),
);

export const aiAuditLogs = pgTable(
  'ai_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: varchar('entity_id', { length: 255 }),
    outcome: varchar('outcome', { length: 30 }).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index('ai_audit_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
    actionIdx: index('ai_audit_logs_action_idx').on(table.tenantId, table.action),
  }),
);
