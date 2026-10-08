import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

/**
 * A quote request.
 *
 * Originally a bare contact form (name/email/company/message). Now tied to a tenant and
 * a product, with a status, so a request can be attributed, triaged, answered, and not
 * answered twice.
 */
export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }).notNull(),
    message: text('message'),

    /** NULL only for rows submitted before this pipeline existed. */
    tenantId: uuid('tenant_id'),
    /** What was asked about. NULL for the original contact-form rows. */
    productId: uuid('product_id'),
    variantId: uuid('variant_id'),

    /** new → contacted → closed. */
    status: varchar('status', { length: 20 }).default('new').notNull(),
    /** Minor units, matching products.price. Never a float, never a formatted string. */
    quotedPrice: integer('quoted_price'),
    adminNote: text('admin_note'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    tenantCreated: index('quotes_tenant_created_idx').on(t.tenantId, t.createdAt),
    productEmail: index('quotes_product_email_idx').on(t.productId, t.email),
  }),
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export const QUOTE_STATUSES = ['new', 'contacted', 'closed'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PRICING_MODES = ['fixed', 'from', 'request'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];
