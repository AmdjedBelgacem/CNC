import { pgTable, uuid, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const financeBudgets = pgTable('finance_budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  period: varchar('period', { length: 20 }).notNull().default('month'),
  category: varchar('category', { length: 50 }).notNull().default('revenue'),
  targetCents: integer('target_cents').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
