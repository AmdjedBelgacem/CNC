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
import { aiConversations, aiMessages } from './ai-assistant';

/** Search backends the assistant can consult for external, non-TITANS evidence. */
export type AiWebSearchProvider = 'brave' | 'tavily' | 'serper' | 'none';

export interface AiWebResultMeta {
  provider: string;
  rank: number;
  fetchedAt: string;
}

/**
 * Web search configuration.
 *
 * Kept in its own table rather than on `ai_provider_configs` because the LLM
 * provider and the search provider are bought, rotated and disabled separately,
 * and a tenant may legitimately run a local model with no outbound search at all.
 */
export const aiWebSearchConfigs = pgTable(
  'ai_web_search_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    provider: varchar('provider', { length: 32 }).$type<AiWebSearchProvider>().default('none').notNull(),
    encryptedApiKey: text('encrypted_api_key'),
    apiKeyVersion: integer('api_key_version').default(1).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    /** Hard ceiling on results handed to the model, whatever the provider offers. */
    maxResults: integer('max_results').default(5).notNull(),
    timeoutMs: integer('timeout_ms').default(8000).notNull(),
    /** Empty means "any public host"; entries are hostnames, not URLs. */
    allowedDomains: jsonb('allowed_domains').$type<string[]>().default([]).notNull(),
    /** Only these chat modes may reach the network. */
    allowedModes: jsonb('allowed_modes').$type<string[]>().default(['fact_check']).notNull(),
    cacheTtlSeconds: integer('cache_ttl_seconds').default(3600).notNull(),
    status: varchar('status', { length: 30 }).default('disabled').notNull(),
    lastTestedAt: timestamp('last_tested_at'),
    lastErrorCode: varchar('last_error_code', { length: 80 }),
  },
  (table) => ({
    tenantUnique: uniqueIndex('ai_web_search_configs_tenant_unique').on(table.tenantId),
  }),
);

/**
 * Short-lived result cache.
 *
 * Fact-checking the same claim from a class of forty students must not spend
 * forty search quotas, and it must not let one member decide what the next one
 * sees by racing the cache.
 */
export const aiWebSearchCache = pgTable(
  'ai_web_search_cache',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    provider: varchar('provider', { length: 32 }).notNull(),
    queryHash: varchar('query_hash', { length: 64 }).notNull(),
    query: text('query').notNull(),
    results: jsonb('results').$type<unknown[]>().default([]).notNull(),
    resultCount: integer('result_count').default(0).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    cacheLookup: uniqueIndex('ai_web_search_cache_lookup_unique').on(
      table.tenantId,
      table.provider,
      table.queryHash,
    ),
    expiryIdx: index('ai_web_search_cache_expiry_idx').on(table.expiresAt),
  }),
);

/**
 * Thumbs up/down on an answer.
 *
 * This is the raw material for the learning loop. Without it, prompt and model
 * changes are unfalsifiable guesses.
 */
export const aiFeedback = pgTable(
  'ai_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    conversationId: uuid('conversation_id')
      .references(() => aiConversations.id, { onDelete: 'cascade' })
      .notNull(),
    messageId: uuid('message_id').references(() => aiMessages.id, { onDelete: 'cascade' }).notNull(),
    /** 1 = helpful, -1 = not. 0 is a cleared vote, not "neutral". */
    rating: integer('rating').notNull(),
    reason: varchar('reason', { length: 200 }),
    mode: varchar('mode', { length: 32 }),
    usedWeb: boolean('used_web').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // One vote per member per answer: a re-vote updates in place.
    voterUnique: uniqueIndex('ai_feedback_voter_unique').on(table.messageId, table.userId),
    tenantRatingIdx: index('ai_feedback_tenant_rating_idx').on(table.tenantId, table.rating),
    conversationIdx: index('ai_feedback_conversation_idx').on(table.conversationId),
  }),
);

/** A question plus what a correct answer must contain, and what it must not. */
export const aiEvalCases = pgTable(
  'ai_eval_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    question: text('question').notNull(),
    mode: varchar('mode', { length: 32 }).default('general').notNull(),
    /** Substrings a grounded answer should mention. */
    expectKeywords: jsonb('expect_keywords').$type<string[]>().default([]).notNull(),
    /** Substrings that indicate a hallucination or a leaked instruction. */
    forbidKeywords: jsonb('forbid_keywords').$type<string[]>().default([]).notNull(),
    /** A grounded answer must carry at least this many citations. */
    minCitations: integer('min_citations').default(0).notNull(),
    /** The answer is expected to refuse / say it cannot verify. */
    expectRefusal: boolean('expect_refusal').default(false).notNull(),
    expectWeb: boolean('expect_web').default(false).notNull(),
    sourceRef: jsonb('source_ref').$type<Record<string, unknown> | null>(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantSlugUnique: uniqueIndex('ai_eval_cases_tenant_slug_unique').on(table.tenantId, table.slug),
    enabledIdx: index('ai_eval_cases_enabled_idx').on(table.tenantId, table.enabled),
  }),
);

/** One scored pass of the case set, so two configs can be compared. */
export const aiEvalRuns = pgTable(
  'ai_eval_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    model: varchar('model', { length: 200 }),
    promptVersion: varchar('prompt_version', { length: 40 }),
    webEnabled: boolean('web_enabled').default(false).notNull(),
    totalCases: integer('total_cases').default(0).notNull(),
    passedCases: integer('passed_cases').default(0).notNull(),
    /** 0..1, the mean of per-case scores. */
    score: real('score').default(0).notNull(),
    citationCoverage: real('citation_coverage').default(0).notNull(),
    groundedness: real('groundedness').default(0).notNull(),
    refusalAccuracy: real('refusal_accuracy').default(0).notNull(),
    avgLatencyMs: integer('avg_latency_ms').default(0).notNull(),
    details: jsonb('details').$type<unknown[]>().default([]).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index('ai_eval_runs_tenant_created_idx').on(table.tenantId, table.createdAt),
  }),
);
