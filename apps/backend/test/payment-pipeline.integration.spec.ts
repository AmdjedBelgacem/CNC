import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { courses } from '../src/database/schema/courses';
import { events } from '../src/database/schema/events';
import { DrizzleService } from '../src/database/drizzle.service';
import { MoyasarService } from '../src/modules/payments/moyasar.service';
import { SecretBoxService } from '../src/common/security/secret-box.service';
import { CoursesService } from '../src/modules/courses/courses.service';
import { EventsService } from '../src/modules/events/events.service';
import { orders, orderItems, productPurchases, paymentConfigs, enrollments, users } from '../src/database/schema';
import { productsBundle } from '../src/database/schema/products';

/**
 * The whole money path, end to end, against real Postgres with the gateway
 * replaced by a fixture.
 *
 * `MOYASAR_API` is a constant, not an env var, on purpose: a configurable
 * gateway base URL is a way to post the tenant's secret key somewhere else. So
 * the stub replaces `globalThis.fetch` and asserts on the Authorization header,
 * which also proves the key is only ever sent to the gateway.
 */
describe('payment pipeline (integration)', () => {
  let drizzle: DrizzleService;
  let moyasar: MoyasarService;
  let tenantId: string;
  let userId: string;
  let otherUserId: string;
  let productId: string;
  let courseId: string;
  let eventId: string;
  const orderIds: string[] = [];
  const realFetch = globalThis.fetch;

  const GATEWAY = 'https://api.moyasar.com/v1';
  const payments: Record<string, { id: string; status: string; amount: number; currency: string; metadata?: Record<string, unknown> }> = {};
  const fetchCalls: Array<{ url: string; auth: string | null }> = [];

  const stubFetch = (impl: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      fetchCalls.push({ url, auth: headers.get('authorization') });
      return impl(url, init);
    }) as unknown as typeof fetch;
  };

  const gateway = (id: string) => {
    stubFetch((url) => {
      if (!url.startsWith(GATEWAY)) throw new Error(`secret key must never leave the gateway host: ${url}`);
      const payment = payments[id];
      if (!payment) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
      return new Response(JSON.stringify(payment), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
  };

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as any);
    await drizzle.onModuleInit();

    // Pick a tenant that actually has two members: the buyer and a bystander in
    // the same tenant, which is the case a tenant-only check would get wrong.
    const groups = await drizzle.db
      .select({ tenantId: users.tenantId, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.tenantId)
      .having(sql`count(*) >= 2`)
      .limit(1);
    const group = groups[0];
    if (!group) throw new Error('need a seeded tenant with two users');
    tenantId = group.tenantId;

    const members = await drizzle.db.select().from(users).where(eq(users.tenantId, tenantId)).limit(2);
    if (members.length < 2) throw new Error('need two seeded users');
    userId = members[0]!.id;
    otherUserId = members[1]!.id;

    const [product] = await drizzle.db
      .insert(productsBundle)
      .values({
        tenantId,
        title: `ITest Product ${Date.now()}`,
        // A published row a visitor can see needs an Arabic title in
        // `translations`; `localized-content.spec.ts` scans published products
        // and fails on anything missing one, so this fixture must be valid data.
        translations: { ar: { title: `منتج اختبار ${Date.now()}` } },
        slug: `itest-product-${Date.now()}`,
        price: 25_000,
        isPublished: true,
        trackInventory: true,
        inventory: 10,
      })
      .returning();
    productId = product!.id;

    const [course] = await drizzle.db
      .insert(courses)
      .values({
        tenantId,
        slug: `itest-course-${Date.now()}`,
        title: `ITest Course ${Date.now()}`,
        translations: { ar: { title: `دورة اختبار ${Date.now()}` } },
        difficulty: 1,
        sortOrder: 0,
        priceCents: 40_000,
        isPublished: true,
      })
      .returning();
    courseId = course!.id;

    const [event] = await drizzle.db
      .insert(events)
      .values({
        tenantId,
        slug: `itest-event-${Date.now()}`,
        title: `ITest Event ${Date.now()}`,
        translations: { ar: { title: `فعالية اختبار ${Date.now()}` } },
        isPublished: true,
        price: 15_000,
        maxAttendees: 50,
        startDate: new Date(Date.now() + 86_400_000),
        endDate: new Date(Date.now() + 90_000_000),
      })
      .returning();
    eventId = event!.id;

    // Real credentials so the pipeline is not short-circuited by fail-closed.
    const secrets = new SecretBoxService({ get: (k: string) => process.env[k] } as any);
    // Replace rather than skip: a row left by an earlier run must not decide
    // whether this suite passes.
    await drizzle.db
      .delete(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenantId), eq(paymentConfigs.provider, 'moyasar')));
    await drizzle.db
      .insert(paymentConfigs)
      .values({
        tenantId,
        provider: 'moyasar',
        publishableKey: 'pk_test_itest',
        encryptedSecretKey: secrets.encryptOrThrow('sk_test_itest', tenantId, 'moyasar'),
        encryptedWebhookSecret: secrets.encryptOrThrow('whsec_itest', tenantId, 'moyasar-webhook'),
        currency: 'SAR',
        enabled: true,
        liveMode: false,
        status: 'active',
      });

    moyasar = new MoyasarService(
      drizzle,
      { get: (k: string) => process.env[k] } as any,
      secrets,
      { enrollUser: vi.fn(async () => {}) } as unknown as CoursesService,
      { register: vi.fn(async () => {}) } as unknown as EventsService,
      { notifyUser: vi.fn(async () => {}), notifyTenantAdmins: vi.fn(async () => {}) } as any,
    );
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    // Leave the database as we found it even if a fixture step failed.
    if (!tenantId) return;
    for (const id of orderIds) {
      await drizzle.db.delete(productPurchases).where(eq(productPurchases.orderId, id));
      await drizzle.db.delete(orderItems).where(eq(orderItems.orderId, id));
      await drizzle.db.delete(orders).where(eq(orders.id, id));
    }
    await drizzle.db.delete(productsBundle).where(eq(productsBundle.id, productId));
    await drizzle.db.delete(courses).where(eq(courses.id, courseId));
    await drizzle.db.delete(events).where(eq(events.id, eventId));
    await drizzle.db.delete(enrollments).where(eq(enrollments.courseId, courseId));
    await drizzle.db.delete(paymentConfigs).where(eq(paymentConfigs.tenantId, tenantId));
  });

  const createOrder = async (lines: Array<{ itemType: any; refId: string; quantity?: number }>, who = userId) => {
    const created = await moyasar.createOrder({
      tenantId,
      userId: who,
      lines,
      idempotencyKey: `itest-${Math.random().toString(36).slice(2)}`,
    });
    orderIds.push(created.orderId);
    return created;
  };

  it('issues a signed reference the webhook can resolve before any callback', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 2 }]);
    expect(order.orderRef.orderId).toBe(order.orderId);
    expect(order.orderRef.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(order.amount).toBe(50_000);
  });

  it('settles from a webhook alone, with no callback in sight', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    // The payment exists only in the gateway and carries the signed ref, which is
    // exactly the state a real early `payment_paid` webhook finds.
    payments[`pay_${order.orderId.slice(0, 8)}`] = {
      id: `pay_${order.orderId.slice(0, 8)}`,
      status: 'paid',
      amount: order.amount,
      currency: order.currency,
      metadata: { order_ref: `${order.orderRef.orderId}.${order.orderRef.sig}` },
    };
    gateway(`pay_${order.orderId.slice(0, 8)}`);

    const result = await moyasar.handleWebhook(
      tenantId,
      JSON.stringify({ type: 'payment_paid', data: { id: `pay_${order.orderId.slice(0, 8)}` } }),
      'whsec_itest',
    );
    expect(result).toMatchObject({ received: true, handled: true });

    const [row] = await drizzle.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(row!.status).toBe('paid');
    expect(row!.providerPaymentId).toBe(`pay_${order.orderId.slice(0, 8)}`);
    // And a real purchase record now exists, not just a stock change.
    const purchases = await drizzle.db.select().from(productPurchases).where(eq(productPurchases.orderId, order.orderId));
    expect(purchases).toHaveLength(1);
    expect(purchases[0]!.quantity).toBe(1);
    expect(purchases[0]!.unitAmountCents).toBe(25_000);
  });

  it('refuses a webhook whose reference signature does not match the order', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    const paymentId = `pay_forged_${order.orderId.slice(0, 6)}`;
    // A real, paid payment of the right amount — but pointed at this order with
    // somebody else's signature.
    payments[paymentId] = {
      id: paymentId,
      status: 'paid',
      amount: order.amount,
      currency: order.currency,
      metadata: { order_ref: `${order.orderRef.orderId}.${'0'.repeat(64)}` },
    };
    gateway(paymentId);
    const result = await moyasar.handleWebhook(
      tenantId,
      JSON.stringify({ type: 'payment_paid', data: { id: paymentId } }),
      'whsec_itest',
    );
    expect(result).toMatchObject({ handled: false, reason: 'unknown_order' });
    const [row] = await drizzle.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(row!.status).toBe('pending');
    expect(await drizzle.db.select().from(productPurchases).where(eq(productPurchases.orderId, order.orderId))).toHaveLength(0);
  });

  it('refuses to let a bystander settle the buyer order', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    const paymentId = `pay_x_${order.orderId.slice(0, 6)}`;
    payments[paymentId] = { id: paymentId, status: 'paid', amount: order.amount, currency: order.currency };
    gateway(paymentId);

    await expect(
      moyasar.settleFromPayment({
        tenantId,
        orderId: order.orderId,
        paymentId,
        trigger: 'callback',
        actorUserId: otherUserId,
      }),
    ).rejects.toThrow(/Order not found/);

    const [row] = await drizzle.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(row!.status).toBe('pending');
  });

  it('lets the buyer settle their own order', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    const paymentId = `pay_own_${order.orderId.slice(0, 6)}`;
    payments[paymentId] = { id: paymentId, status: 'paid', amount: order.amount, currency: order.currency };
    gateway(paymentId);
    const result = await moyasar.settleFromPayment({
      tenantId,
      orderId: order.orderId,
      paymentId,
      trigger: 'callback',
      actorUserId: userId,
    });
    expect(result).toMatchObject({ status: 'paid', fulfilled: true });
  });

  it('never double-delivers on replayed callbacks', async () => {
    const order = await createOrder([{ itemType: 'course', refId: courseId }]);
    const paymentId = `pay_replay_${order.orderId.slice(0, 6)}`;
    payments[paymentId] = { id: paymentId, status: 'paid', amount: order.amount, currency: order.currency };
    gateway(paymentId);

    const first = await moyasar.settleFromPayment({
      tenantId, orderId: order.orderId, paymentId, trigger: 'callback', actorUserId: userId,
    });
    const second = await moyasar.settleFromPayment({
      tenantId, orderId: order.orderId, paymentId, trigger: 'callback', actorUserId: userId,
    });
    const viaWebhook = await moyasar.handleWebhook(
      tenantId,
      JSON.stringify({ type: 'payment_paid', data: { id: paymentId } }),
      'whsec_itest',
    );

    expect(first.fulfilled).toBe(true);
    expect(second.fulfilled).toBe(true);
    expect(viaWebhook.handled).toBe(true);

    const lines = await drizzle.db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fulfillmentState).toBe('fulfilled');
    // The enrolment was delegated exactly once.
    const enrolCalls = (moyasar as any).courses.enrollUser as ReturnType<typeof vi.fn>;
    expect(enrolCalls.mock.calls.filter((call: any[]) => call[2] === courseId)).toHaveLength(1);
  });

  it('refuses to re-fulfil an order that was never paid', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    await expect(moyasar.refulfillOrder(tenantId, order.orderId)).rejects.toThrow(/Only a paid order/);
  });

  it('re-fulfils a paid order whose line failed', async () => {
    const order = await createOrder([{ itemType: 'product', refId: productId, quantity: 1 }]);
    const paymentId = `pay_refill_${order.orderId.slice(0, 6)}`;
    payments[paymentId] = { id: paymentId, status: 'paid', amount: order.amount, currency: order.currency };
    gateway(paymentId);
    await moyasar.settleFromPayment({
      tenantId, orderId: order.orderId, paymentId, trigger: 'callback', actorUserId: userId,
    });

    // Simulate a line that failed after payment, as a crashed worker would leave.
    await drizzle.db.delete(productPurchases).where(eq(productPurchases.orderId, order.orderId));
    await drizzle.db.update(orderItems).set({ fulfillmentState: 'failed', fulfillmentError: 'worker died' }).where(eq(orderItems.orderId, order.orderId));

    const before = await drizzle.db.select().from(productsBundle).where(eq(productsBundle.id, productId));
    const result = await moyasar.refulfillOrder(tenantId, order.orderId);
    expect(result.complete).toBe(true);

    const purchases = await drizzle.db.select().from(productPurchases).where(eq(productPurchases.orderId, order.orderId));
    expect(purchases).toHaveLength(1);
    const after = await drizzle.db.select().from(productsBundle).where(eq(productsBundle.id, productId));
    // Stock moved once, not twice.
    expect(Number(before[0]!.inventory) - Number(after[0]!.inventory)).toBe(1);

    // Re-running again changes nothing: the claim and the unique index hold.
    const again = await moyasar.refulfillOrder(tenantId, order.orderId);
    expect(again.complete).toBe(true);
    expect(await drizzle.db.select().from(productPurchases).where(eq(productPurchases.orderId, order.orderId))).toHaveLength(1);
  });

  it('charges all three purchasable types through the one pipeline', async () => {
    for (const [itemType, refId] of [
      ['course', courseId],
      ['event_ticket', eventId],
      ['product', productId],
    ] as const) {
      const order = await createOrder([{ itemType, refId }]);
      const paymentId = `pay_${itemType}_${order.orderId.slice(0, 6)}`;
      payments[paymentId] = { id: paymentId, status: 'paid', amount: order.amount, currency: order.currency };
      gateway(paymentId);
      const result = await moyasar.settleFromPayment({
        tenantId, orderId: order.orderId, paymentId, trigger: 'callback', actorUserId: userId,
      });
      expect(result.fulfilled).toBe(true);
      const lines = await drizzle.db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId));
      expect(lines[0]!.itemType).toBe(itemType);
      expect(lines[0]!.fulfillmentState).toBe('fulfilled');
    }
  });

  it('only ever sends the secret key to the gateway', () => {
    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const call of fetchCalls) expect(call.url.startsWith(GATEWAY)).toBe(true);
    for (const call of fetchCalls) expect(call.auth).toMatch(/^Basic /);
  });
});
