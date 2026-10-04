import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  text,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
export type OrderProvider = 'moyasar' | 'stripe';
/** What a line item sells. Extensible: any future payable entity adds a type. */
export type OrderItemType = 'course' | 'product' | 'event_ticket' | 'bundle' | 'custom';
export type FulfillmentState = 'pending' | 'fulfilled' | 'skipped' | 'failed';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    total: integer('total').notNull(),
    subtotal: integer('subtotal').notNull(),
    tax: integer('tax').default(0),
    shipping: integer('shipping').default(0),
    currency: varchar('currency', { length: 3 }).default('SAR'),
    shippingAddress: jsonb('shipping_address'),
    billingAddress: jsonb('billing_address'),

    // --- gateway-neutral payment identity -------------------------------
    provider: varchar('provider', { length: 32 }).default('moyasar').notNull(),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    /** Redacted gateway response kept for reconciliation. Never holds secrets. */
    providerPayload: jsonb('provider_payload').$type<Record<string, unknown>>(),
    // --- legacy gateway columns -------------------------------------------
    // Stripe is no longer the primary path but its sessions still exist, and
    // historical orders are read by the admin finance views.
    stripeSessionId: varchar('stripe_session_id', { length: 255 }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    medusaOrderId: varchar('medusa_order_id', { length: 255 }),
    /**
     * Client-supplied key that makes order creation safe to retry: a double
     * click must not create two orders, and a retry must return the first one.
     */
    idempotencyKey: varchar('idempotency_key', { length: 120 }),
    paidAt: timestamp('paid_at'),
    refundedAt: timestamp('refunded_at'),
    canceledAt: timestamp('canceled_at'),
    failureReason: varchar('failure_reason', { length: 255 }),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantUserIdx: index('orders_tenant_user_idx').on(table.tenantId, table.userId),
    statusIdx: index('orders_status_idx').on(table.tenantId, table.status),
    providerIdx: index('orders_provider_idx').on(table.providerPaymentId),
    // One order per (tenant, idempotency key). Null keys are exempt, which is
    // what lets a caller opt out.
    idempotencyUnique: uniqueIndex('orders_tenant_idempotency_unique').on(table.tenantId, table.idempotencyKey),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => orders.id).notNull(),
    /** Which kind of thing this line buys. */
    itemType: varchar('item_type', { length: 32 }).default('product').notNull(),
    /** Id of the thing being bought (course id, product id, event id). */
    refId: uuid('ref_id'),
    productId: uuid('product_id').notNull(),
    variantId: uuid('variant_id'),
    title: varchar('title', { length: 300 }).notNull(),
    variantTitle: varchar('variant_title', { length: 200 }),
    sku: varchar('sku', { length: 100 }),
    quantity: integer('quantity').notNull(),
    /** Frozen at purchase time: later price edits must not change history. */
    price: integer('price').notNull(),
    unitAmountCents: integer('unit_amount_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).default('SAR'),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    isDigital: boolean('is_digital').default(false),
    isBackordered: boolean('is_backordered').default(false),
    /**
     * Fulfillment is tracked per line so a paid order with three lines cannot
     * double-enroll: the transition to `fulfilled` is the claim.
     */
    fulfillmentState: varchar('fulfillment_state', { length: 20 }).default('pending').notNull(),
    fulfilledAt: timestamp('fulfilled_at'),
    fulfillmentError: varchar('fulfillment_error', { length: 255 }),
  },
  (table) => ({
    orderIdx: index('order_items_order_idx').on(table.orderId),
    // A given entity can only be claimed once per order, so a duplicate webhook
    // cannot fulfil the same line twice.
    lineUnique: uniqueIndex('order_items_order_ref_unique').on(table.orderId, table.itemType, table.refId),
  }),
);
