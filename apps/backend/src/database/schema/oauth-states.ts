import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const oauthStates = pgTable('oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: varchar('state', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('any'),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  codeVerifier: varchar('code_verifier', { length: 255 }),
  redirectTo: varchar('redirect_to', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  stateIdx: uniqueIndex('oauth_states_state_idx').on(table.state),
  expiresIdx: index('oauth_states_expires_idx').on(table.expiresAt),
}));
