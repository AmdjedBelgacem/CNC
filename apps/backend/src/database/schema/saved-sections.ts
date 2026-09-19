import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import type { PuckNode } from '@titan/shared';

/**
 * Tenant-scoped library of reusable section subtrees. `node` is the saved
 * container (usually a section); `zones` holds every zone entry the subtree
 * owns, keyed `<nodeId>:<zone>`, mirroring `PageLayout.zones`.
 */
export const savedSections = pgTable('saved_sections', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  node: jsonb('node').$type<PuckNode>().notNull(),
  zones: jsonb('zones').$type<Record<string, PuckNode[]>>().notNull().default({}),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('saved_sections_tenant_idx').on(table.tenantId),
}));
