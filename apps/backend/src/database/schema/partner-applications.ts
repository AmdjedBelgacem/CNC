import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const PARTNER_APPLICATION_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'needs_info',
] as const;
export type PartnerApplicationStatus = (typeof PARTNER_APPLICATION_STATUSES)[number];

export const PARTNER_APPLICATION_TYPES = [
  'sponsor',
  'distributor',
  'training_center',
  'affiliate',
  'other',
] as const;
export type PartnerApplicationType = (typeof PARTNER_APPLICATION_TYPES)[number];

export const partnerApplicationStatusEnum = pgEnum('partner_application_status', PARTNER_APPLICATION_STATUSES);
export const partnerApplicationTypeEnum = pgEnum('partner_application_type', PARTNER_APPLICATION_TYPES);

export const partnerApplications = pgTable(
  'partner_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    type: partnerApplicationTypeEnum('type').notNull(),
    companyName: varchar('company_name', { length: 200 }).notNull(),
    website: varchar('website', { length: 500 }),
    contactName: varchar('contact_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    phone: varchar('phone', { length: 60 }),
    country: varchar('country', { length: 100 }),
    city: varchar('city', { length: 100 }),
    message: text('message').notNull(),
    socialLinks: jsonb('social_links').$type<Record<string, string>>().default({}).notNull(),
    audienceSize: varchar('audience_size', { length: 100 }),
    status: partnerApplicationStatusEnum('status').default('pending').notNull(),
    adminNotes: text('admin_notes'),
    reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    infoRequestMessage: text('info_request_message'),
    source: jsonb('source').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    tenantStatusIdx: index('partner_applications_tenant_status_idx').on(t.tenantId, t.status),
    tenantEmailIdx: index('partner_applications_tenant_email_idx').on(t.tenantId, t.email),
    tenantCreatedIdx: index('partner_applications_tenant_created_idx').on(t.tenantId, t.createdAt),
  }),
);