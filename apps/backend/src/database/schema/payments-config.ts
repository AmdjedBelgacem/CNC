import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/** Gateways the platform can settle through. */
export type PaymentProviderName = 'moyasar' | 'stripe';

/**
 * Per-tenant gateway credentials.
 *
 * Separate from `ai_provider_configs` on purpose: a payment secret has a much
 * longer life and a far worse blast radius than a model key, and it must be
 * rotatable per gateway without touching anything else.
 */
export const paymentConfigs = pgTable(
  'payment_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    provider: varchar('provider', { length: 32 }).$type<PaymentProviderName>().default('moyasar').notNull(),
    /**
     * Safe to hand to the browser: this is the only key that ever leaves the
     * server, and it cannot move money on its own.
     */
    publishableKey: varchar('publishable_key', { length: 200 }),
    /** Server-only. AES-256-GCM, AAD bound to (tenantId, provider). */
    encryptedSecretKey: text('encrypted_secret_key'),
    secretKeyVersion: integer('secret_key_version').default(1).notNull(),
    /**
     * Shared secret Moyasar echoes back so a webhook can be authenticated. A
     * webhook without it is rejected: an unauthenticated webhook is a free
     * "mark this order paid" endpoint.
     */
    encryptedWebhookSecret: text('encrypted_webhook_secret'),
    /** ISO-4217. Defaults to SAR; halalas are the smallest unit. */
    currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    /** Where Moyasar returns the payer after the form. */
    successUrl: varchar('success_url', { length: 500 }),
    cancelUrl: varchar('cancel_url', { length: 500 }),
    liveMode: boolean('live_mode').default(false).notNull(),
    status: varchar('status', { length: 30 }).default('disabled').notNull(),
    lastTestedAt: timestamp('last_tested_at'),
    lastErrorCode: varchar('last_error_code', { length: 80 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantProviderUnique: uniqueIndex('payment_configs_tenant_provider_unique').on(table.tenantId, table.provider),
  }),
);

export type GoogleIntegrationService =
  | 'google_ads'
  | 'merchant_center'
  | 'tag_manager'
  | 'search_console';

/**
 * Platform-level Google connections (not per tenant: one Google account links
 * the Ads account, the Merchant Center feed, the GTM container and the Search
 * Console property for the whole install).
 */
export const googleIntegrations = pgTable(
  'google_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    service: varchar('service', { length: 40 }).$type<GoogleIntegrationService>().notNull(),
    /** Server-only, AES-256-GCM, AAD bound to the service name. */
    encryptedRefreshToken: text('encrypted_refresh_token'),
    /** Google account email, for display so a super admin knows who is linked. */
    connectedEmail: varchar('connected_email', { length: 320 }),
    /** Ads customer id, Merchant account id, GTM container id, GSC property. */
    externalAccountId: varchar('external_account_id', { length: 255 }),
    /** GTM accounts/containers discovered at connect time. */
    externalAccountIds: jsonb('external_account_ids').$type<string[]>().default([]).notNull(),
    scopes: jsonb('scopes').$type<string[]>().default([]).notNull(),
    status: varchar('status', { length: 30 }).default('not_connected').notNull(),
    lastVerifiedAt: timestamp('last_verified_at'),
    lastErrorCode: varchar('last_error_code', { length: 80 }),
    lastErrorMessage: varchar('last_error_message', { length: 500 }),
    connectedBy: uuid('connected_by'),
    connectedAt: timestamp('connected_at'),
    disconnectedAt: timestamp('disconnected_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    serviceUnique: uniqueIndex('google_integrations_service_unique').on(table.service),
    statusIdx: index('google_integrations_status_idx').on(table.status),
  }),
);

/** Short-lived OAuth state; a callback is only honoured with a live row. */
export const googleOauthStates = pgTable(
  'google_oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stateHash: varchar('state_hash', { length: 64 }).notNull(),
    service: varchar('service', { length: 40 }).$type<GoogleIntegrationService>().notNull(),
    /** Super admin who started the flow, so a hijacked callback cannot rebind it. */
    initiatedBy: uuid('initiated_by').notNull(),
    /** CSRF token the browser must echo back through the app session. */
    csrfToken: varchar('csrf_token', { length: 120 }).notNull(),
    returnTo: varchar('return_to', { length: 500 }),
    redirectUri: varchar('redirect_uri', { length: 500 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    stateUnique: uniqueIndex('google_oauth_states_hash_unique').on(table.stateHash),
    expiryIdx: index('google_oauth_states_expiry_idx').on(table.expiresAt),
  }),
);
