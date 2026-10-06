import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import { emailOutbox, emailTemplates, emailTriggerBindings } from '../src/database/schema/emails';
import { tenants } from '../src/database/schema/tenants';
import { DEFAULT_EMAIL_LAYOUT, renderEmail } from '../src/modules/email/email-compiler';
import { allowedPathsFor, getTrigger } from '../src/modules/email/trigger.registry';

/**
 * Database-backed outbox behaviour.
 *
 * Opt-in on purpose. The repo's other integration specs resolve DATABASE_URL
 * implicitly from `apps/backend/.env`, which points at the PRODUCTION Supabase
 * instance — so they create real rows there. This spec refuses to do that: it
 * requires EMAIL_TEST_DATABASE_URL to be set explicitly and skips without it.
 */
const TEST_URL = process.env.EMAIL_TEST_DATABASE_URL;
const describeDb = TEST_URL ? describe : describe.skip;

describeDb('email outbox — idempotency and drain safety', () => {
  let drizzle: DrizzleService;
  const suffix = `email-outbox-${Date.now()}`;
  let tenantId: string;
  let templateId: string;

  const basePayload = {
    user: { firstName: 'Ahmed' },
    order: {
      id: 'ORD-TEST',
      total: 'SAR 1,250.00',
      currency: 'SAR',
      paidAt: '2026-10-06T00:00:00.000Z',
      items: 'CNC Course x1',
      hasInvoice: false,
    },
    supportEmail: 'support@barootcnc.com',
  };

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => (k === 'DATABASE_URL' ? TEST_URL : process.env[k]) } as never);
    await drizzle.onModuleInit();

    const [tenant] = await drizzle.db
      .insert(tenants)
      .values({ name: `Email Outbox ${suffix}`, slug: suffix })
      .returning();
    tenantId = tenant.id;

    const [template] = await drizzle.db
      .insert(emailTemplates)
      .values({
        tenantId,
        slug: suffix,
        name: 'Test receipt',
        category: 'commerce',
        subjectTemplate: 'Receipt for {{order.id}}',
        layout: DEFAULT_EMAIL_LAYOUT,
        status: 'published',
        version: 1,
      })
      .returning();
    templateId = template.id;

    await drizzle.db.insert(emailTriggerBindings).values({
      tenantId,
      triggerKey: 'commerce.order_paid',
      templateId,
      enabled: true,
    });
  });

  afterAll(async () => {
    if (!drizzle) return;
    await drizzle.db.delete(emailTriggerBindings).where(eq(emailTriggerBindings.tenantId, tenantId));
    await drizzle.db.delete(emailOutbox).where(eq(emailOutbox.tenantId, tenantId));
    await drizzle.db.delete(emailTemplates).where(eq(emailTemplates.tenantId, tenantId));
    await drizzle.db.delete(tenants).where(eq(tenants.id, tenantId));
    await (drizzle as unknown as { client?: { end?: () => void } }).client?.end?.();
  });

  async function insertRow(key: string | null) {
    const [row] = await drizzle.db
      .insert(emailOutbox)
      .values({
        tenantId,
        triggerKey: 'commerce.order_paid',
        templateId,
        templateVersion: 1,
        recipientEmail: 'buyer@example.com',
        payload: basePayload,
        subject: 'Receipt for ORD-TEST',
        fromAddress: 'Baroot CNC Solutions <onboarding@resend.dev>',
        idempotencyKey: key,
        status: 'queued',
        bodyHash: 'a'.repeat(64),
      })
      .returning();
    return row;
  }

  it('accepts the first send for an idempotency key', async () => {
    const key = `${suffix}:order_paid:ORD-A`;
    const row = await insertRow(key);
    expect(row.id).toBeTruthy();
  });

  it('rejects a duplicate send for the same idempotency key', async () => {
    // This is the guarantee that makes a replayed payment webhook safe: the
    // second attempt is refused by the database, not by application logic that a
    // future code path could forget to call.
    const key = `${suffix}:order_paid:ORD-A`;
    const result = await drizzle.db
      .insert(emailOutbox)
      .values({
        tenantId,
        triggerKey: 'commerce.order_paid',
        templateId,
        templateVersion: 1,
        recipientEmail: 'buyer@example.com',
        payload: basePayload,
        subject: 'Receipt for ORD-TEST',
        fromAddress: 'Baroot CNC Solutions <onboarding@resend.dev>',
        idempotencyKey: key,
        status: 'queued',
      })
      // Target-less: a partial unique index cannot be an ON CONFLICT arbiter.
      .onConflictDoNothing()
      .returning();

    expect(result).toHaveLength(0);

    const [{ count }] = await drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, key));
    expect(Number(count)).toBe(1);
  });

  it('allows many rows when no idempotency key is supplied', async () => {
    // Non-idempotent triggers (welcome, re-sent verification) pass no key and
    // must not collide, which is why the unique index is partial.
    await insertRow(null);
    await insertRow(null);
    const [{ count }] = await drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.tenantId, tenantId), sql`${emailOutbox.idempotencyKey} is null`));
    expect(Number(count)).toBeGreaterThanOrEqual(2);
  });

  it('claims a disjoint batch under concurrent workers (SKIP LOCKED)', async () => {
    await drizzle.db.insert(emailOutbox).values(
      Array.from({ length: 6 }, (_, i) => ({
        tenantId,
        triggerKey: 'commerce.order_paid',
        templateId,
        templateVersion: 1,
        recipientEmail: `bulk${i}@example.com`,
        payload: basePayload,
        subject: 'Bulk',
        fromAddress: 'Baroot CNC Solutions <onboarding@resend.dev>',
        idempotencyKey: `${suffix}:bulk:${i}`,
        status: 'queued' as const,
      })),
    );

    const claim = () =>
      drizzle.db
        .update(emailOutbox)
        .set({ status: 'sending', updatedAt: new Date() })
        .where(
          sql`id in (
            SELECT id FROM email_outbox
            WHERE status = 'queued' AND idempotency_key like ${`${suffix}:bulk:%`}
            ORDER BY scheduled_for LIMIT 3
            FOR UPDATE SKIP LOCKED)`,
        )
        .returning({ id: emailOutbox.id });

    const [a, b] = await Promise.all([claim(), claim()]);
    const overlap = a.filter((r) => b.some((x) => x.id === r.id));
    expect(overlap, 'two workers claimed the same row').toHaveLength(0);
    expect(a.length + b.length).toBe(6);
  });

  it('stores no body, only a hash', async () => {
    // A password-reset URL must not be readable out of the log by anyone.
    const columns = await drizzle.db.execute(
      sql`select column_name from information_schema.columns
          where table_name = 'email_outbox'`,
    ) as unknown as Array<{ column_name: string }>;
    const names = columns.map((c) => c.column_name);
    expect(names).toContain('body_hash');
    expect(names).not.toContain('body');
    expect(names).not.toContain('html');
    expect(names).not.toContain('text');
  });
});

describe('order_paid renders from the stored payload', () => {
  it('renders the receipt the outbox would send', () => {
    const trigger = getTrigger('commerce.order_paid')!;
    const out = renderEmail(
      {
        ...DEFAULT_EMAIL_LAYOUT,
        blocks: [
          { id: 'h', type: 'heading', props: { text: 'Payment received', level: 1, align: 'left', color: '#111' } },
          {
            id: 't',
            type: 'text',
            props: { html: 'Hi {{user.firstName}}, we received {{order.total}}.', align: 'left', color: '#111', fontSize: 16, lineHeight: 1.6 },
          },
          {
            id: 'inv',
            type: 'text',
            props: {
              html: '{{#if order.hasInvoice}}Your invoice is ready.{{/if}}',
              align: 'left', color: '#111', fontSize: 14, lineHeight: 1.6,
            },
          },
        ],
      },
      {
        user: { firstName: 'Ahmed' },
        order: { id: 'ORD-1', total: 'SAR 1,250.00', hasInvoice: true },
      },
      'Receipt for {{order.id}}',
      null,
      {
        fromAddress: 'onboarding@resend.dev',
        supportEmail: null,
        replyTo: null,
        unsubscribeUrlPath: null,
        utm: null,
        allowedPaths: allowedPathsFor(trigger),
      },
    );
    expect(out.subject).toBe('Receipt for ORD-1');
    expect(out.html).toContain('SAR 1,250.00');
    expect(out.html).toContain('Your invoice is ready.');
  });

  it('omits the invoice section when hasInvoice is false', () => {
    const trigger = getTrigger('commerce.order_paid')!;
    const out = renderEmail(
      {
        ...DEFAULT_EMAIL_LAYOUT,
        blocks: [
          {
            id: 'inv',
            type: 'text',
            props: {
              html: '{{#if order.hasInvoice}}Your invoice is ready.{{/if}}',
              align: 'left', color: '#111', fontSize: 14, lineHeight: 1.6,
            },
          },
        ],
      },
      { user: { firstName: 'Ahmed' }, order: { id: 'ORD-1', total: 'SAR 0.00', hasInvoice: false } },
      'S',
      null,
      {
        fromAddress: 'onboarding@resend.dev',
        supportEmail: null,
        replyTo: null,
        unsubscribeUrlPath: null,
        utm: null,
        allowedPaths: allowedPathsFor(trigger),
      },
    );
    expect(out.html).not.toContain('Your invoice is ready');
  });
});