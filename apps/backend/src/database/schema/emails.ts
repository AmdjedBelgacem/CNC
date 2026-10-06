import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  integer,
  timestamp,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import type {
  EmailCategory,
  EmailLayout,
  EmailTemplateStatus,
  EmailVariableDef,
} from '@titan/shared';

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /**
     * NULL only for `isSystem` templates, which super_admin authors and every
     * tenant inherits. Non-null for all tenant-owned rows.
     */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    category: varchar('category', { length: 20 }).$type<EmailCategory>().notNull(),
    layout: jsonb('layout').$type<EmailLayout>().notNull(),
    /**
     * The draft's subject and preheader. Held on the template as well as on each
     * version because the editor needs them while the template is still a draft,
     * and a version row only exists once something has been published.
     */
    subjectTemplate: varchar('subject_template', { length: 500 }).default('').notNull(),
    preheaderTemplate: varchar('preheader_template', { length: 300 }),
    variableSchema: jsonb('variable_schema').$type<EmailVariableDef[]>().default([]).notNull(),
    /**
     * `archived` is the third state: the row and its version history stay, but
     * no trigger can resolve to it and the editor is read-only. Same spirit as
     * the page builder's `disabled`.
     */
    status: varchar('status', { length: 12 })
      .$type<EmailTemplateStatus>()
      .default('draft')
      .notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    version: integer('version').default(0).notNull(),
    publishedAt: timestamp('published_at'),
    publishedById: uuid('published_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    tenantSlugIdx: uniqueIndex('email_templates_tenant_slug_idx').on(t.tenantId, t.slug),
    tenantCategoryIdx: index('email_templates_tenant_category_idx').on(t.tenantId, t.category),
    statusIdx: index('email_templates_status_idx').on(t.status),
  }),
);

/**
 * Immutable snapshot written on every publish. Mirrors `page_versions`: history
 * is append-only, so rollback is "publish an old version as a new version" and
 * nothing that was ever sent can be silently rewritten.
 */
export const emailTemplateVersions = pgTable(
  'email_template_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .references(() => emailTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    version: integer('version').notNull(),
    subjectTemplate: varchar('subject_template', { length: 500 }).notNull(),
    preheaderTemplate: varchar('preheader_template', { length: 300 }),
    layout: jsonb('layout').$type<EmailLayout>().notNull(),
    variableSchema: jsonb('variable_schema').$type<EmailVariableDef[]>().notNull(),
    /**
     * The artifact an admin actually reviewed, rendered from the bound trigger's
     * sample payload. This is the reference, not the per-send body: a data table
     * driven by `{{#each order.items}}` cannot be frozen into static HTML. The
     * per-send body comes from re-running the same deterministic render, so
     * preview and send are byte-identical for identical payloads by
     * construction rather than by a stored-copy convention.
     */
    compiledHtml: text('compiled_html').notNull(),
    compiledText: text('compiled_text').notNull(),
    /** sha256 of compiledHtml + compiledText, plus COMPILER_VERSION. */
    compileHash: varchar('compile_hash', { length: 64 }).notNull(),
    schemaVersion: integer('schema_version').default(1).notNull(),
    status: varchar('status', { length: 12 }).$type<'snapshot' | 'published'>()
      .default('published')
      .notNull(),
    note: varchar('note', { length: 500 }),
    changedById: uuid('changed_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    templateVersionIdx: uniqueIndex('email_template_versions_tpl_version_idx').on(
      t.templateId,
      t.version,
    ),
    tenantIdx: index('email_template_versions_tenant_idx').on(t.tenantId),
  }),
);

/**
 * Maps a registry trigger key to a template for a tenant (override) or for
 * everyone (system default). `triggerKey` references `TRIGGER_REGISTRY`; there
 * is deliberately no free-text trigger field anywhere in the product.
 */
export const emailTriggerBindings = pgTable(
  'email_trigger_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** NULL = the system-wide default every tenant inherits. */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    triggerKey: varchar('trigger_key', { length: 60 }).notNull(),
    templateId: uuid('template_id')
      .references(() => emailTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    /** NULL locale = the fallback used when no locale-specific row matches. */
    locale: varchar('locale', { length: 10 }),
    /** Disabled = explicit no-send. The template is kept, not deleted. */
    enabled: boolean('enabled').default(true).notNull(),
    delayMinutes: integer('delay_minutes').default(0).notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    /**
     * Two partial unique indexes, not one composite. Postgres treats NULLs as
     * distinct inside a unique index, so a single
     * `unique(tenantId, triggerKey, locale)` would let an unlimited number of
     * duplicate *system* defaults (tenantId NULL) exist — and duplicate system
     * defaults make trigger resolution non-deterministic.
     */
    tenantTriggerLocaleIdx: uniqueIndex('email_bindings_tenant_trigger_locale_idx')
      .on(t.tenantId, t.triggerKey, t.locale)
      .where(sql`${t.tenantId} is not null`),
    systemTriggerLocaleIdx: uniqueIndex('email_bindings_system_trigger_locale_idx')
      .on(t.triggerKey, t.locale)
      .where(sql`${t.tenantId} is null`),
    triggerIdx: index('email_bindings_trigger_idx').on(t.triggerKey),
  }),
);

/**
 * One row per logical send, mutated through its lifecycle. This doubles as the
 * send log: a separate log table would duplicate state and force a join to
 * answer the only question the screen asks ("did this send?).
 *
 * The body is deliberately absent — only `bodyHash` is stored. A reset URL must
 * never sit in a column something could log, query, or export.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    triggerKey: varchar('trigger_key', { length: 60 }).notNull(),
    templateId: uuid('template_id').references(() => emailTemplates.id, {
      onDelete: 'set null',
    }),
    templateVersion: integer('template_version').default(0).notNull(),
    recipientEmail: varchar('recipient_email', { length: 320 }).notNull(),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    locale: varchar('locale', { length: 10 }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** Resolved at enqueue so the log shows what was actually attempted. */
    subject: varchar('subject', { length: 500 }).notNull(),
    fromAddress: varchar('from_address', { length: 320 }).notNull(),
    replyTo: varchar('reply_to', { length: 320 }),
    /** The duplicate-suppression claim. Unique; see the dispatch service. */
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    status: varchar('status', { length: 12 })
      .$type<'queued' | 'sending' | 'sent' | 'failed' | 'dead'>()
      .default('queued')
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastErrorCode: varchar('last_error_code', { length: 60 }),
    lastErrorMessage: varchar('last_error_message', { length: 500 }),
    provider: varchar('provider', { length: 20 }).default('resend').notNull(),
    providerId: varchar('provider_id', { length: 120 }),
    /** sha256 of the final body. The body itself is never persisted here. */
    bodyHash: varchar('body_hash', { length: 64 }),
    scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    /**
     * Partial, not a plain unique: triggers that are not naturally idempotent
     * (welcome-before-verified, a re-sent reset) deliberately pass no key and
     * must not collide on NULL. A composite unique would also reject a second
     * NULL-locale row for the same tenant+trigger.
     */
    idempotencyIdx: uniqueIndex('email_outbox_idempotency_idx')
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    /** Supports the drainer's `status = 'queued' AND scheduled_for <= now()`. */
    drainIdx: index('email_outbox_drain_idx').on(t.status, t.scheduledFor),
    tenantIdx: index('email_outbox_tenant_idx').on(t.tenantId),
    triggerIdx: index('email_outbox_trigger_idx').on(t.triggerKey),
    recipientIdx: index('email_outbox_recipient_idx').on(t.recipientUserId),
    createdIdx: index('email_outbox_created_idx').on(t.createdAt),
  }),
);