import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
