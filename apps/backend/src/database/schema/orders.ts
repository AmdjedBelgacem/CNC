import { pgTable, uuid, varchar, integer, jsonb, timestamp, text, boolean } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  total: integer('total').notNull(),
  subtotal: integer('subtotal').notNull(),
  tax: integer('tax').default(0),
  shipping: integer('shipping').default(0),
  currency: varchar('currency', { length: 3 }).default('USD'),
  shippingAddress: jsonb('shipping_address'),
  billingAddress: jsonb('billing_address'),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  medusaOrderId: varchar('medusa_order_id', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').notNull(),
  variantId: uuid('variant_id'),
  title: varchar('title', { length: 300 }).notNull(),
  variantTitle: varchar('variant_title', { length: 200 }),
  sku: varchar('sku', { length: 100 }),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  isDigital: boolean('is_digital').default(false),
  isBackordered: boolean('is_backordered').default(false),
});
