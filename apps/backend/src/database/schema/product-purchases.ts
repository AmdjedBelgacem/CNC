import { relations, sql } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { orders, orderItems } from './orders';

/**
 * What a buyer actually bought.
 *
 * Fulfilling a product line used to mean "decrement stock", which leaves no
 * answer to "do they own it?" after the fact. This is that answer, and the
 * unique index on `order_item_id` is what makes a duplicate webhook or a retry
 * safe: the second insert loses and is treated as already delivered.
 */
export const productPurchases = pgTable(
  'product_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    orderId: uuid('order_id').notNull(),
    orderItemId: uuid('order_item_id').notNull(),
    productId: uuid('product_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    /** Frozen, so a later price edit does not rewrite what was paid. */
    unitAmountCents: integer('unit_amount_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).default('SAR'),
    status: varchar('status', { length: 20 }).notNull().default('recorded'),
    refundedAt: timestamp('refunded_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    /** One purchase per order line: the double-delivery guard. */
    itemUnique: uniqueIndex('product_purchases_order_item_unique').on(table.orderItemId),
    buyerIdx: index('product_purchases_tenant_user_idx').on(table.tenantId, table.userId),
    orderIdx: index('product_purchases_order_idx').on(table.orderId),
  }),
);

export const productPurchasesRelations = relations(productPurchases, ({ one }) => ({
  order: one(orders, { fields: [productPurchases.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [productPurchases.orderItemId], references: [orderItems.id] }),
}));

export type ProductPurchase = typeof productPurchases.$inferSelect;
export type NewProductPurchase = typeof productPurchases.$inferInsert;
export const PRODUCT_PURCHASE_STATUSES = ['recorded', 'refunded', 'revoked'] as const;
export type ProductPurchaseStatus = (typeof PRODUCT_PURCHASE_STATUSES)[number];
/** Used only by the schema snapshot export. */
export const productPurchasesSql = sql``;
