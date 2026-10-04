import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { ConfigService } from '../../config/config.service';
import { DrizzleService } from '../../database/drizzle.service';
import {
  orderItems,
  orders,
  type FulfillmentState,
  type OrderItemType,
  type OrderStatus,
} from '../../database/schema/orders';
import { paymentConfigs } from '../../database/schema/payments-config';
import { courses } from '../../database/schema/courses';
import { productsBundle, productVariants } from '../../database/schema/products';
import { events } from '../../database/schema/events';
import { enrollments } from '../../database/schema/progress';
import { productPurchases } from '../../database/schema/product-purchases';
import { SecretBoxService } from '../../common/security/secret-box.service';
import { CoursesService } from '../courses/courses.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAlertsService } from '../notifications/platform-alerts.service';

const MOYASAR_API = 'https://api.moyasar.com/v1';
const MAX_LINES = 20;
const MAX_QUANTITY = 25;
/** A pending order that never gets a callback expires rather than living forever. */
const ORDER_TTL_MINUTES = 60;

export interface MoyasarRuntime {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string | null;
  currency: string;
  liveMode: boolean;
}

export interface CreateOrderLineInput {
  itemType: OrderItemType;
  refId: string;
  quantity?: number;
  variantId?: string;
}

export interface VerifiedPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string | null;
  /**
   * Echoed back by the gateway from the form's `metadata`. A webhook can use it
   * to find the order, but only when {@link signOrderRef} vouches for it.
   */
  metadata: Record<string, unknown>;
}

/**
 * The pointer a payment carries back to its order.
 *
 * The hosted form is created in the browser, so the first `payment_paid` webhook
 * can arrive before the callback, and at that moment no order holds the payment
 * id. `order_ref` closes that window — but a bare order id in metadata is a
 * pointer anyone could forge, so it is signed over the order id *and* its total.
 * A forged reference to a victim's order cannot be produced without the key, and
 * even a valid one still has to pass the amount and currency checks.
 */
export interface OrderRef {
  orderId: string;
  sig: string;
}

interface MoyasarWebhookEnvelope {
  id?: string;
  type?: string;
  secret_token?: string;
  data?: { id?: string };
  created_at?: string;
}

/**
 * Moyasar as the primary payment gateway.
 *
 * The rule this class exists to enforce: **an order is only ever marked paid
 * after the gateway has been asked and has agreed.** The browser telling us a
 * payment succeeded is not evidence, so the callback re-fetches the payment with
 * the secret key and checks status, amount and currency. Webhooks are a second
 * path to the same code, not a shortcut around it.
 */
@Injectable()
export class MoyasarService {
  private readonly logger = new Logger(MoyasarService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
    private readonly secrets: SecretBoxService,
    // Fulfillment reuses the same enrolment and registration paths the free
    // flows use, so a paid ticket and a free one cannot drift apart.
    private readonly courses: CoursesService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly platformAlerts: PlatformAlertsService,
  ) {}

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Resolve live credentials. Throws rather than degrading: without a secret key
   * the platform cannot take money, and silently stubbing a "paid" order is the
   * one failure mode that must never happen.
   */
  async getRuntime(tenantId: string): Promise<MoyasarRuntime> {
    const [row] = await this.drizzle.db
      .select()
      .from(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenantId), eq(paymentConfigs.provider, 'moyasar')))
      .limit(1);

    if (!row) {
      throw new ServiceUnavailableException('Payments are not configured for this workspace');
    }
    if (!row.enabled) {
      throw new ServiceUnavailableException('Payments are disabled for this workspace');
    }
    if (!row.publishableKey) {
      throw new ServiceUnavailableException('Payments are missing a publishable key');
    }

    let secretKey: string | null = null;
    if (row.encryptedSecretKey && this.secrets.configured) {
      try {
        secretKey = this.secrets.decrypt(row.encryptedSecretKey, tenantId, 'moyasar');
      } catch {
        throw new ServiceUnavailableException('Stored payment credentials could not be read');
      }
    }
    // Env fallback lets a single-tenant deployment work without the admin screen.
    if (!secretKey) {
      secretKey = (this.config.get('MOYASAR_SECRET_KEY') as string | undefined) ?? null;
    }
    if (!secretKey) {
      throw new ServiceUnavailableException('Payments are missing a server secret key');
    }

    let webhookSecret: string | null = null;
    if (row.encryptedWebhookSecret && this.secrets.configured) {
      try {
        webhookSecret = this.secrets.decrypt(row.encryptedWebhookSecret, tenantId, 'moyasar-webhook');
      } catch {
        webhookSecret = null;
      }
    }
    if (!webhookSecret) {
      webhookSecret = (this.config.get('MOYASAR_WEBHOOK_SECRET') as string | undefined) ?? null;
    }

    return {
      publishableKey: row.publishableKey,
      secretKey,
      webhookSecret,
      currency: (row.currency || 'SAR').toUpperCase(),
      liveMode: row.liveMode,
    };
  }

  /** Public shape for checkout: never includes the secret key. */
  async getPublicSettings(tenantId: string): Promise<{
    publishableKey: string | null;
    currency: string;
    liveMode: boolean;
    enabled: boolean;
    status: string;
    lastErrorCode: string | null;
  }> {
    const [row] = await this.drizzle.db
      .select()
      .from(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenantId), eq(paymentConfigs.provider, 'moyasar')))
      .limit(1);
    if (!row) {
      return {
        publishableKey: null,
        currency: 'SAR',
        liveMode: false,
        enabled: false,
        status: 'not_configured',
        lastErrorCode: null,
      };
    }
    return {
      publishableKey: row.enabled ? row.publishableKey : null,
      currency: (row.currency || 'SAR').toUpperCase(),
      liveMode: row.liveMode,
      enabled: row.enabled,
      status: row.status,
      lastErrorCode: row.lastErrorCode ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Order creation
  // -------------------------------------------------------------------------

  /**
   * Build a pending order from line items. Every price comes from the database:
   * the client may say what it wants to buy, never what it costs.
   */
  async createOrder(params: {
    tenantId: string;
    userId: string;
    lines: CreateOrderLineInput[];
    idempotencyKey?: string | null;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    status: string;
    /** Signed pointer for the gateway's `metadata`, used by webhook resolution. */
    orderRef: OrderRef;
  }> {
    const runtime = await this.getRuntime(params.tenantId);

    if (!Array.isArray(params.lines) || params.lines.length === 0) {
      throw new BadRequestException('An order needs at least one line');
    }
    if (params.lines.length > MAX_LINES) {
      throw new BadRequestException(`An order can hold at most ${MAX_LINES} lines`);
    }

    // A retried request must not create a second order.
    if (params.idempotencyKey) {
      const [existing] = await this.drizzle.db
        .select({ id: orders.id, total: orders.total, currency: orders.currency, status: orders.status })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, params.tenantId),
            eq(orders.idempotencyKey, params.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          orderId: existing.id,
          amount: existing.total,
          currency: existing.currency ?? 'SAR',
          status: existing.status ?? 'pending',
          orderRef: this.signOrderRef(existing.id, existing.total),
        };
      }
    }

    const resolved: Array<{
      itemType: OrderItemType;
      refId: string;
      productId: string;
      variantId: string | null;
      title: string;
      variantTitle: string | null;
      sku: string | null;
      unitAmountCents: number;
      currency: string;
      quantity: number;
      thumbnailUrl: string | null;
      isDigital: boolean;
    }> = [];

    for (const line of params.lines) {
      const quantity = Math.min(Math.max(Math.floor(Number(line.quantity ?? 1)), 1), MAX_QUANTITY);
      if (line.itemType === 'course') {
        const course = await this.drizzle.db.query.courses.findFirst({
          where: and(eq(courses.id, line.refId), eq(courses.tenantId, params.tenantId)),
          columns: { id: true, title: true, priceCents: true, isPublished: true, isArchived: true, slug: true },
        });
        if (!course) throw new NotFoundException('Course not found');
        if (!course.isPublished || course.isArchived) {
          throw new BadRequestException('This course is not available for purchase');
        }
        if (!course.priceCents || course.priceCents <= 0) {
          throw new BadRequestException('This course is not priced for purchase');
        }
        // Buying a course you already hold is a no-op, not a charge.
        const already = await this.drizzle.db.query.enrollments.findFirst({
          where: and(eq(enrollments.userId, params.userId), eq(enrollments.courseId, course.id)),
          columns: { id: true },
        });
        if (already) throw new BadRequestException('You already have this course');
        resolved.push({
          itemType: 'course',
          refId: course.id,
          productId: course.id,
          variantId: null,
          title: course.title,
          variantTitle: null,
          sku: null,
          unitAmountCents: course.priceCents,
          currency: runtime.currency,
          quantity,
          thumbnailUrl: null,
          isDigital: true,
        });
        continue;
      }

      if (line.itemType === 'event_ticket') {
        const event = await this.drizzle.db.query.events.findFirst({
          where: and(eq(events.id, line.refId), eq(events.tenantId, params.tenantId)),
          columns: { id: true, title: true, price: true, isPublished: true, slug: true },
        });
        if (!event) throw new NotFoundException('Event not found');
        if (!event.isPublished) throw new BadRequestException('This event is not on sale');
        if (!event.price || event.price <= 0) {
          throw new BadRequestException('This event is not a paid ticket');
        }
        resolved.push({
          itemType: 'event_ticket',
          refId: event.id,
          productId: event.id,
          variantId: null,
          title: event.title,
          variantTitle: null,
          sku: null,
          unitAmountCents: event.price,
          currency: runtime.currency,
          quantity,
          thumbnailUrl: null,
          isDigital: true,
        });
        continue;
      }

      // Product (and anything that resolves through the product table).
      const [product] = await this.drizzle.db
        .select()
        .from(productsBundle)
        .where(and(eq(productsBundle.id, line.refId), eq(productsBundle.tenantId, params.tenantId)))
        .limit(1);
      if (!product) throw new NotFoundException('Product not found');
      if (!product.isPublished || product.isArchived) {
        throw new BadRequestException('This product is not available');
      }

      let unitAmountCents = product.price;
      let variantTitle: string | null = null;
      let sku: string | null = null;
      if (line.variantId) {
        const [variant] = await this.drizzle.db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, line.variantId))
          .limit(1);
        if (!variant || String(variant.productId) !== String(product.id)) {
          throw new BadRequestException('Variant not found on this product');
        }
        if (variant.price) unitAmountCents = variant.price;
        variantTitle = variant.title ?? null;
        sku = variant.sku ?? null;
      }
      if (unitAmountCents <= 0) throw new BadRequestException('This product is not purchasable');
      if (
        product.trackInventory &&
        !product.allowBackorder &&
        typeof product.inventory === 'number' &&
        product.inventory < quantity
      ) {
        throw new BadRequestException('Not enough stock for this product');
      }

      resolved.push({
        itemType: 'product',
        refId: product.id,
        productId: product.id,
        variantId: line.variantId ?? null,
        title: product.title,
        variantTitle,
        sku,
        unitAmountCents,
        currency: runtime.currency,
        quantity,
        thumbnailUrl: product.thumbnailUrl ?? null,
        isDigital: product.isDigital ?? false,
      });
    }

    const subtotal = resolved.reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0);
    const total = subtotal; // No tax or shipping until a tenant configures them.

    const [created] = await this.drizzle.db
      .insert(orders)
      .values({
        tenantId: params.tenantId,
        userId: params.userId,
        status: 'pending',
        provider: 'moyasar',
        providerPayload: null,
        idempotencyKey: params.idempotencyKey ?? null,
        total,
        subtotal,
        tax: 0,
        shipping: 0,
        currency: runtime.currency,
        notes: null,
      })
      .returning();
    if (!created) throw new Error('Failed to create order');

    await this.drizzle.db.insert(orderItems).values(
      resolved.map((line) => ({
        orderId: created.id,
        itemType: line.itemType,
        refId: line.refId,
        productId: line.productId,
        variantId: line.variantId,
        title: line.title,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        price: line.unitAmountCents,
        unitAmountCents: line.unitAmountCents,
        currency: line.currency,
        thumbnailUrl: line.thumbnailUrl,
        isDigital: line.isDigital,
        isBackordered: false,
        fulfillmentState: 'pending',
      })),
    );

    return {
      orderId: created.id,
      amount: total,
      currency: runtime.currency,
      status: created.status ?? 'pending',
      orderRef: this.signOrderRef(created.id, total),
    };
  }

  // -------------------------------------------------------------------------
  // Order reference (webhook → order, without waiting for the callback)
  // -------------------------------------------------------------------------

  /**
   * HMAC over the order id and its total, keyed by the app's auth secret.
   *
   * The total is in the signature so the reference cannot be replayed against an
   * order of a different value: a payment for 100 SAR cannot claim the order
   * that was created for 10000 SAR.
   */
  signOrderRef(orderId: string, total: number): OrderRef {
    const key = this.config.get('AUTH_SECRET');
    if (!key) {
      // Without a key nothing can be signed, so no signed reference is issued and
      // webhooks fall back to the payment id recorded at settle time.
      throw new ServiceUnavailableException('Order references are not available');
    }
    const sig = createHmac('sha256', key).update(`${orderId}:${total}`).digest('hex');
    return { orderId, sig };
  }

  private verifyOrderRef(ref: OrderRef, total: number): boolean {
    let expected: OrderRef;
    try {
      expected = this.signOrderRef(ref.orderId, total);
    } catch {
      return false;
    }
    const a = Buffer.from(expected.sig, 'hex');
    const b = Buffer.from(String(ref.sig ?? ''), 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  }

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------

  /**
   * Fetch a payment from Moyasar with the secret key.
   *
   * Basic auth with the key as the username and an empty password is Moyasar's
   * documented scheme. The URL is a fixed constant plus a validated id, so there
   * is no user-controlled host.
   */
  async fetchPayment(tenantId: string, paymentId: string): Promise<VerifiedPayment> {
    const runtime = await this.getRuntime(tenantId);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(paymentId)) throw new BadRequestException('Invalid payment id');

    const response = await fetch(`${MOYASAR_API}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        // Moyasar: Basic auth where the secret key is the username.
        authorization: `Basic ${Buffer.from(`${runtime.secretKey}:`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(15000),
    }).catch((error: Error) => {
      this.logger.warn(`Moyasar fetch failed for ${paymentId}: ${error.message}`);
      throw new ServiceUnavailableException('Payment provider is unreachable');
    });

    if (response.status === 404) throw new NotFoundException('Payment not found');
    if (response.status === 401 || response.status === 403) {
      await this.recordConfigError(tenantId, 'invalid_credentials');
      throw new ServiceUnavailableException('Payment credentials were rejected');
    }
    if (!response.ok) throw new ServiceUnavailableException('Payment provider returned an error');

    const body = (await response.json()) as Record<string, unknown>;
    return {
      id: String(body['id'] ?? paymentId),
      status: String(body['status'] ?? 'unknown').toLowerCase(),
      amount: Number(body['amount'] ?? 0),
      currency: String(body['currency'] ?? runtime.currency).toUpperCase(),
      description: typeof body['description'] === 'string' ? body['description'] : null,
      createdAt: typeof body['created_at'] === 'string' ? body['created_at'] : null,
      metadata:
        body['metadata'] && typeof body['metadata'] === 'object' && !Array.isArray(body['metadata'])
          ? (body['metadata'] as Record<string, unknown>)
          : {},
    };
  }

  /**
   * Turn a payment id into a settled order, but only if the gateway agrees.
   *
   * Checks, in order: the order exists and belongs to this tenant; the payment is
   * paid or captured; the amount matches what we charged; the currency matches.
   * A mismatch is recorded on the order and never fulfilled.
   */
  async settleFromPayment(params: {
    tenantId: string;
    orderId: string;
    paymentId: string;
    trigger: 'callback' | 'webhook';
    /**
     * The signed-in buyer, for a `callback`. A tenant match is not enough: any
     * authenticated member of the tenant could otherwise settle another member's
     * order by guessing its id. Webhooks have no user and rely on the signature
     * in {@link findOrderBySignedRef} instead.
     */
    actorUserId?: string | null;
  }): Promise<{ orderId: string; status: OrderStatus; fulfilled: boolean; reason?: string }> {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, params.orderId), eq(orders.tenantId, params.tenantId)))
      .limit(1);
    // 404 rather than 403: a non-owner must not learn the order exists.
    if (!order) throw new NotFoundException('Order not found');

    if (params.trigger === 'callback' && params.actorUserId && order.userId !== params.actorUserId) {
      this.logger.warn(
        `Refused to settle order ${order.id} for user ${params.actorUserId}: not the buyer`,
      );
      throw new NotFoundException('Order not found');
    }

    // Already settled: idempotent by definition, so a duplicate webhook is a no-op.
    if (order.status === 'paid') {
      return { orderId: order.id, status: 'paid', fulfilled: true };
    }

    const payment = await this.fetchPayment(params.tenantId, params.paymentId);

    const paid = payment.status === 'paid' || payment.status === 'captured';
    if (!paid) {
      const failed = ['failed', 'canceled', 'voided'].includes(payment.status);
      const status: OrderStatus = failed ? 'failed' : ((order.status ?? 'pending') as OrderStatus);
      await this.drizzle.db
        .update(orders)
        .set({ status, providerPaymentId: payment.id, failureReason: `payment_${payment.status}` })
        .where(eq(orders.id, order.id));
      return { orderId: order.id, status, fulfilled: false, reason: `payment_${payment.status}` };
    }

    // Amount and currency must agree to the halala. A short payment is never
    // fulfilled, whatever the gateway says.
    if (payment.amount !== order.total) {
      await this.drizzle.db
        .update(orders)
        .set({
          status: 'failed',
          providerPaymentId: payment.id,
          failureReason: 'amount_mismatch',
        })
        .where(eq(orders.id, order.id));
      this.logger.error(
        `Amount mismatch on order ${order.id}: charged ${payment.amount}, expected ${order.total}`,
      );
      // Logged and returned, but nothing else in the product reacts: a payer is
      // charged and the order stays unfulfilled. A super admin has to see this.
      await this.platformAlerts
        .emit({
          group: 'payments',
          type: 'payment_amount_mismatch',
          title: `Payment amount mismatch on order ${order.id}`,
          body:
            `Charged ${payment.amount} but the order total is ${order.total}. ` +
            `The order was not fulfilled and the payment was not captured on our side.`,
          tenantId: params.tenantId,
          entityType: 'order',
          entityId: order.id,
          href: `/admin/orders`,
          data: { charged: payment.amount, expected: order.total, currency: payment.currency },
        })
        .catch((e) => this.logger.error(`platform alert failed: ${e?.message}`));
      return { orderId: order.id, status: 'failed', fulfilled: false, reason: 'amount_mismatch' };
    }
    if (payment.currency.toUpperCase() !== (order.currency ?? '').toUpperCase()) {
      await this.drizzle.db
        .update(orders)
        .set({
          status: 'failed',
          providerPaymentId: payment.id,
          failureReason: 'currency_mismatch',
        })
        .where(eq(orders.id, order.id));
      this.logger.error(`Currency mismatch on order ${order.id}: ${payment.currency} vs ${order.currency}`);
      await this.platformAlerts
        .emit({
          group: 'payments',
          type: 'payment_currency_mismatch',
          title: `Payment currency mismatch on order ${order.id}`,
          body:
            `Provider settled in ${payment.currency} but the order is denominated in ${order.currency}. ` +
            `The order was not fulfilled.`,
          tenantId: params.tenantId,
          entityType: 'order',
          entityId: order.id,
          href: `/admin/orders`,
          data: { chargedCurrency: payment.currency, expectedCurrency: order.currency },
        })
        .catch((e) => this.logger.error(`platform alert failed: ${e?.message}`));
      return { orderId: order.id, status: 'failed', fulfilled: false, reason: 'currency_mismatch' };
    }

    // Guard the transition so two concurrent webhooks cannot both fulfil.
    const claimed = await this.drizzle.db
      .update(orders)
      .set({
        status: 'paid',
        providerPaymentId: payment.id,
        providerPayload: this.redactProviderPayload(payment),
        paidAt: new Date(),
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(
        // `status <> 'paid'` is the claim: only the first writer sees a row.
        and(eq(orders.id, order.id), sql`${orders.status} <> 'paid'`),
      )
      .returning({ id: orders.id });

    if (claimed.length === 0) {
      return { orderId: order.id, status: 'paid', fulfilled: true };
    }

    const fulfilled = await this.fulfillOrder(params.tenantId, order.id);
    return { orderId: order.id, status: 'paid', fulfilled };
  }

  /** Keep a gateway response for reconciliation, minus anything sensitive. */
  private redactProviderPayload(payment: VerifiedPayment): Record<string, unknown> {
    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      created_at: payment.createdAt,
      order_ref: (payment.metadata['order_ref'] as string | undefined) ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Fulfillment — runs once per line
  // -------------------------------------------------------------------------

  /**
   * Deliver what was bought. Each line is claimed with a conditional update, so
   * a duplicate webhook cannot enrol someone twice or decrement stock twice.
   */
  async fulfillOrder(tenantId: string, orderId: string): Promise<boolean> {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (!order) return false;

    // `failed` is in scope on purpose. A line that threw on delivery must be
    // retryable, otherwise a transient database blip costs the buyer their
    // purchase permanently.
    const lines = await this.drizzle.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, orderId),
          inArray(orderItems.fulfillmentState, ['pending', 'failed']),
        ),
      );

    let allOk = true;
    let delivered = 0;
    for (const line of lines) {
      // Claim by moving the line out of both `pending` and `failed` at once. Two
      // concurrent retries therefore cannot both deliver the same line.
      const claimed = await this.drizzle.db
        .update(orderItems)
        .set({ fulfillmentState: 'processing', fulfillmentError: null })
        .where(
          and(
            eq(orderItems.id, line.id),
            inArray(orderItems.fulfillmentState, ['pending', 'failed']),
          ),
        )
        .returning({ id: orderItems.id });
      if (claimed.length === 0) continue;

      try {
        await this.deliverLine(tenantId, order.userId, order, line);
        await this.drizzle.db
          .update(orderItems)
          .set({ fulfillmentState: 'fulfilled', fulfilledAt: new Date(), fulfillmentError: null })
          .where(eq(orderItems.id, line.id));
        delivered += 1;
      } catch (error) {
        allOk = false;
        const message = (error as Error).message.slice(0, 255);
        // Back to `failed`, which the next retry selects again.
        await this.drizzle.db
          .update(orderItems)
          .set({ fulfillmentState: 'failed', fulfillmentError: message })
          .where(eq(orderItems.id, line.id));
        this.logger.error(`Fulfillment failed for line ${line.id}: ${message}`);
      }
    }

    if (delivered > 0) {
      this.notifyOrderPaid(tenantId, order.userId, order.id, order.total, order.currency ?? 'SAR');
    }
    return allOk;
  }

  /**
   * Re-run delivery for an order that is paid but not fully delivered.
   *
   * Used by the admin retry endpoint. Safe to call repeatedly: the per-line
   * claim and the unique index on product_purchases both make a repeat a no-op.
   */
  async refulfillOrder(tenantId: string, orderId: string) {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'paid') throw new BadRequestException('Only a paid order can be re-fulfilled');
    const fulfilled = await this.fulfillOrder(tenantId, orderId);
    return { refulfilled: true, complete: fulfilled, order: await this.getOrderForAdmin(tenantId, orderId) };
  }

  private notifyOrderPaid(
    tenantId: string,
    userId: string,
    orderId: string,
    amount: number,
    currency: string,
  ): void {
    void this.notifications
      ?.notifyUser({
        tenantId,
        userId,
        type: 'payment_received',
        category: 'commerce',
        title: 'Payment received',
        body: `Your order for ${(amount / 100).toFixed(2)} ${currency} is confirmed.`,
        href: `/checkout/success?order=${orderId}`,
        entityType: 'order',
        entityId: orderId,
        idempotencyKey: `order-paid:${tenantId}:${orderId}`,
      })
      .catch(() => {});
    void this.notifications?.notifyTenantAdmins(tenantId, {
      type: 'order_paid_staff',
      category: 'commerce',
      title: 'New paid order',
      body: `Order ${orderId.slice(0, 8)} — ${(amount / 100).toFixed(2)} ${currency}`,
      href: `/admin/finance?orderId=${orderId}`,
      entityType: 'order',
      entityId: orderId,
      idempotencyKey: `order-paid-staff:${tenantId}:${orderId}`,
    }).catch(() => {});
  }

  private async deliverLine(
    tenantId: string,
    userId: string,
    order: { id: string },
    line: {
      id: string;
      itemType: string;
      refId: string | null;
      quantity: number;
      unitAmountCents: number;
      currency: string | null;
    },
  ): Promise<void> {
    if (line.itemType === 'course') {
      // Delegates to the single enrolment path the free flow already uses.
      await this.courses.enrollUser(tenantId, userId, line.refId!);
      return;
    }
    if (line.itemType === 'event_ticket') {
      await this.events.register(line.refId!, userId, tenantId);
      return;
    }

    // Product: a real purchase record first, then stock.
    const [product] = await this.drizzle.db
      .select()
      .from(productsBundle)
      .where(and(eq(productsBundle.id, line.refId!), eq(productsBundle.tenantId, tenantId)))
      .limit(1);
    if (!product) throw new Error('product no longer exists');

    // The unique index on order_item_id is the double-delivery guard: if this
    // line already has a purchase, a retry is a no-op rather than a second one.
    const recorded = await this.drizzle.db
      .insert(productPurchases)
      .values({
        tenantId,
        userId,
        orderId: order.id,
        orderItemId: line.id,
        productId: product.id,
        quantity: line.quantity,
        unitAmountCents: line.unitAmountCents,
        currency: line.currency ?? 'SAR',
        status: 'recorded',
      })
      .onConflictDoNothing({ target: productPurchases.orderItemId })
      .returning({ id: productPurchases.id });

    if (recorded.length === 0) {
      // Already delivered by an earlier run: the purchase stands, and stock must
      // not be decremented again.
      this.logger.warn(`Line ${line.id} already had a purchase record; skipping delivery`);
      return;
    }

    if (product.trackInventory) {
      await this.drizzle.db
        .update(productsBundle)
        .set({ inventory: sql`greatest(${productsBundle.inventory} - ${line.quantity}, 0)` })
        .where(eq(productsBundle.id, product.id));
    }
  }

  /** A buyer's purchases, for support and for the account page. */
  async listProductPurchases(tenantId: string, userId: string, limit = 50) {
    return this.drizzle.db
      .select()
      .from(productPurchases)
      .where(and(eq(productPurchases.tenantId, tenantId), eq(productPurchases.userId, userId)))
      .orderBy(desc(productPurchases.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  async refund(params: {
    tenantId: string;
    orderId: string;
    amountCents?: number;
    reason?: string;
  }): Promise<{ refunded: boolean; amount: number; paymentId: string | null }> {
    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, params.orderId), eq(orders.tenantId, params.tenantId)))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'paid') throw new BadRequestException('Only a paid order can be refunded');
    if (!order.providerPaymentId) throw new BadRequestException('This order has no gateway payment to refund');

    const runtime = await this.getRuntime(params.tenantId);
    const amount = Math.min(Math.max(params.amountCents ?? order.total, 1), order.total);

    const response = await fetch(`${MOYASAR_API}/payments/${order.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${runtime.secretKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({ amount }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {
      throw new ServiceUnavailableException('Payment provider is unreachable');
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Refund failed for order ${order.id}: ${response.status} ${detail.slice(0, 200)}`);
      throw new ServiceUnavailableException('The payment provider rejected the refund');
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const refundedAmount = Number(body['amount'] ?? amount);

    // A refunded product is no longer a purchase. Marking it here keeps
    // "do they still own it?" answerable after the money goes back.
    if (refundedAmount >= order.total) {
      await this.drizzle.db
        .update(productPurchases)
        .set({ status: 'refunded', refundedAt: new Date(), updatedAt: new Date() })
        .where(eq(productPurchases.orderId, order.id));
    }

    await this.drizzle.db
      .update(orders)
      .set({
        status: refundedAmount >= order.total ? 'refunded' : 'paid',
        refundedAt: new Date(),
        providerPayload: {
          ...(typeof order.providerPayload === 'object' && order.providerPayload ? order.providerPayload : {}),
          refund: { id: String(body['id'] ?? ''), amount: refundedAmount, reason: params.reason ?? null },
        },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return { refunded: true, amount: refundedAmount, paymentId: order.providerPaymentId };
  }

  // -------------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------------

  /**
   * Moyasar posts a signed event. The shared secret is compared in constant time,
   * and the payload is treated as a pointer only — the truth still comes from
   * re-fetching the payment.
   */
  async handleWebhook(
    tenantId: string,
    rawBody: string,
    providedSecret: string | null,
  ): Promise<{ received: true; handled: boolean; reason?: string }> {
    let envelope: MoyasarWebhookEnvelope;
    try {
      envelope = JSON.parse(rawBody) as MoyasarWebhookEnvelope;
    } catch {
      return { received: true, handled: false, reason: 'invalid_json' };
    }

    const runtime = await this.getRuntime(tenantId);
    if (!runtime.webhookSecret) {
      // Fail closed: without a secret an unauthenticated caller could mark any
      // order paid by posting a forged event.
      this.logger.error('Moyasar webhook received but no webhook secret is configured');
      return { received: true, handled: false, reason: 'webhook_secret_not_configured' };
    }
    if (!providedSecret || !this.constantTimeEquals(providedSecret, runtime.webhookSecret)) {
      this.logger.warn('Moyasar webhook rejected: secret mismatch');
      return { received: true, handled: false, reason: 'bad_secret' };
    }

    const type = String(envelope.type ?? '');
    const paymentId = envelope.data?.id ? String(envelope.data.id) : null;
    if (!paymentId) return { received: true, handled: false, reason: 'no_payment_id' };

    const order = await this.findOrderByPayment(tenantId, paymentId);

    if (type === 'payment_paid' || type === 'payment_created') {
      let target = order;
      if (!target) {
        // The hosted form is created in the browser, so this webhook can be the
        // first thing that tells us the payment exists. The signed reference in
        // the payment's own metadata resolves the order without depending on the
        // callback having arrived first.
        target = await this.findOrderBySignedRef(tenantId, paymentId);
      }
      if (!target) {
        this.logger.warn(`Moyasar ${type} for unknown payment ${paymentId}`);
        return { received: true, handled: false, reason: 'unknown_order' };
      }
      const result = await this.settleFromPayment({
        tenantId,
        orderId: target.id,
        paymentId,
        trigger: 'webhook',
      });
      return { received: true, handled: true, reason: result.reason };
    }

    if (type === 'payment_refunded' && order) {
      await this.drizzle.db
        .update(orders)
        .set({ status: 'refunded', refundedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
      return { received: true, handled: true };
    }

    if (type === 'payment_failed' && order) {
      await this.drizzle.db
        .update(orders)
        .set({ status: 'failed', failureReason: 'payment_failed' })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
      await this.platformAlerts
        .emit({
          group: 'payments',
          type: 'payment_failed',
          title: `Payment failed on order ${order.id}`,
          body:
            `The provider reported a failed payment for order ${order.id} ` +
            `(${order.currency ?? ''} ${(order.total ?? 0) / 100}). The learner was not charged.`,
          tenantId,
          entityType: 'order',
          entityId: order.id,
          href: `/admin/orders`,
          data: { amount: (order.total ?? 0) / 100, currency: order.currency },
        })
        .catch((e) => this.logger.error(`platform alert failed: ${e?.message}`));
      return { received: true, handled: true };
    }

    if (type === 'payment_voided' && order) {
      await this.drizzle.db
        .update(orders)
        .set({ status: 'canceled', canceledAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
      return { received: true, handled: true };
    }

    // A webhook we do not recognise is how integration drift announces itself.
    // Without this it is invisible until a payment is silently missed.
    await this.platformAlerts
      .emit({
        group: 'system',
        type: 'payment_webhook_unhandled',
        title: `Unhandled payment webhook: ${type || '(no type)'}`,
        body:
          `The provider sent a "${type || 'unknown'}" event that this build does not handle. ` +
          `It was acknowledged but not acted on.`,
        tenantId,
        href: '/admin/settings',
        data: { webhookType: type ?? null },
      })
      .catch((e) => this.logger.error(`platform alert failed: ${e?.message}`));
    return { received: true, handled: false, reason: `unhandled_${type || 'type'}` };
  }

  /**
   * Resolve the order behind a payment we have never seen settled.
   *
   * The reference is only trusted after its signature checks out against the
   * order's own total, so a payment cannot be pointed at somebody else's order.
   * The payment is fetched with the secret key first: the webhook body is not
   * evidence of anything.
   */
  private async findOrderBySignedRef(tenantId: string, paymentId: string) {
    let payment: VerifiedPayment;
    try {
      payment = await this.fetchPayment(tenantId, paymentId);
    } catch (error) {
      this.logger.warn(`Could not read payment ${paymentId} for order ref: ${(error as Error).message}`);
      return null;
    }

    const raw = payment.metadata['order_ref'];
    if (typeof raw !== 'string' || !raw.includes('.')) return null;
    const [orderId, sig] = raw.split('.');
    if (!orderId || !sig) return null;

    const [order] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
      .limit(1);
    if (!order) return null;

    if (!this.verifyOrderRef({ orderId, sig }, order.total)) {
      // A forged or tampered reference: refuse rather than settle a guess.
      this.logger.error(`Rejected unsigned/forged order ref on payment ${paymentId} for order ${orderId}`);
      return null;
    }
    return order;
  }

  private async findOrderByPayment(tenantId: string, paymentId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.providerPaymentId, paymentId)))
      .limit(1);
    return row ?? null;
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) diff |= left[index]! ^ right[index]!;
    return diff === 0;
  }

  private async recordConfigError(tenantId: string, code: string): Promise<void> {
    await this.drizzle.db
      .update(paymentConfigs)
      .set({ lastErrorCode: code, status: 'degraded' })
      .where(and(eq(paymentConfigs.tenantId, tenantId), eq(paymentConfigs.provider, 'moyasar')))
      .catch(() => undefined);
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** A member's own orders, tenant-scoped, with their lines. */
  async listMyOrders(tenantId: string, userId: string, limit = 20) {
    const rows = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId)))
      .orderBy(desc(orders.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    if (rows.length === 0) return [];
    return this.attachLines(rows);
  }

  async getOrderForViewer(tenantId: string, userId: string, orderId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          eq(orders.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Order not found');
    const [withLines] = await this.attachLines([row]);
    return withLines!;
  }

  /** Admin view: any order in the tenant. */
  async listOrdersForTenant(tenantId: string, options: { status?: string; limit?: number } = {}) {
    const conditions = [eq(orders.tenantId, tenantId)];
    if (options.status && options.status !== 'all') {
      conditions.push(eq(orders.status, options.status as OrderStatus));
    }
    const rows = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(Math.min(Math.max(options.limit ?? 50, 1), 200));
    return this.attachLines(rows);
  }

  private async attachLines(rows: Array<typeof orders.$inferSelect>) {
    if (rows.length === 0) return [];
    const lines = await this.drizzle.db
      .select()
      .from(orderItems)
      .where(
        sql`${orderItems.orderId} in (${sql.join(
          rows.map((row) => sql`${row.id}`),
          sql`, `,
        )})`,
      );
    const byOrder = new Map<string, typeof orderItems.$inferSelect[]>();
    for (const line of lines) {
      const bucket = byOrder.get(line.orderId) ?? [];
      bucket.push(line);
      byOrder.set(line.orderId, bucket);
    }
    return rows.map((row) => ({
      ...row,
      // The secret-bearing columns never leave the service.
      providerPayload: row.providerPayload ?? null,
      items: (byOrder.get(row.id) ?? []).map((line) => ({
        id: line.id,
        itemType: line.itemType,
        refId: line.refId,
        title: line.title,
        variantTitle: line.variantTitle,
        quantity: line.quantity,
        unitAmountCents: line.unitAmountCents,
        currency: line.currency,
        fulfillmentState: line.fulfillmentState as FulfillmentState,
        fulfilledAt: line.fulfilledAt,
        // Why a line failed, for support. Safe to show: it is our own message.
        fulfillmentError: line.fulfillmentError,
      })),
    }));
  }

  /**
   * Admin view of one order, with everything needed to reconcile it against the
   * gateway: the provider payment id, the last error recorded against it, and
   * the delivery state of every line.
   */
  async getOrderForAdmin(tenantId: string, orderId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new NotFoundException('Order not found');
    const [withLines] = await this.attachLines([row]);
    const lines = withLines?.items ?? [];
    return {
      ...withLines,
      providerPaymentId: row.providerPaymentId ?? null,
      failureReason: row.failureReason ?? null,
      paidAt: row.paidAt,
      refundedAt: row.refundedAt,
      // One flag the UI and the retry button can both read.
      fulfillmentComplete: lines.length > 0 && lines.every((line) => line.fulfillmentState === 'fulfilled'),
      products: await this.drizzle.db
        .select()
        .from(productPurchases)
        .where(eq(productPurchases.orderId, row.id)),
    };
  }

  /** Abandoned checkouts are canceled so history stays honest. */
  async expireStaleOrders(tenantId: string, olderThanMinutes = ORDER_TTL_MINUTES): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stale = await this.drizzle.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'pending'),
          sql`${orders.createdAt} < ${cutoff}`,
          sql`${orders.providerPaymentId} is null`,
        ),
      );
    if (stale.length === 0) return 0;
    await this.drizzle.db
      .update(orders)
      .set({ status: 'canceled', canceledAt: new Date(), failureReason: 'expired' })
      .where(sql`${orders.id} in (${sql.join(stale.map((row) => sql`${row.id}`), sql`, `)})`);
    return stale.length;
  }

  /** Admin: is this tenant able to take money at all? */
  async health(tenantId: string): Promise<{
    configured: boolean;
    enabled: boolean;
    publishableKeyPresent: boolean;
    secretKeyPresent: boolean;
    webhookSecretPresent: boolean;
    currency: string;
    liveMode: boolean;
    status: string;
    lastErrorCode: string | null;
    encryptionReady: boolean;
  }> {
    const [row] = await this.drizzle.db
      .select()
      .from(paymentConfigs)
      .where(and(eq(paymentConfigs.tenantId, tenantId), eq(paymentConfigs.provider, 'moyasar')))
      .limit(1);
    if (!row) {
      return {
        configured: false,
        enabled: false,
        publishableKeyPresent: false,
        secretKeyPresent: false,
        webhookSecretPresent: false,
        currency: 'SAR',
        liveMode: false,
        status: 'not_configured',
        lastErrorCode: null,
        encryptionReady: this.secrets.configured,
      };
    }
    return {
      configured: true,
      enabled: row.enabled,
      publishableKeyPresent: Boolean(row.publishableKey),
      secretKeyPresent:
        Boolean(row.encryptedSecretKey) || Boolean(this.config.get('MOYASAR_SECRET_KEY') as string | undefined),
      webhookSecretPresent:
        Boolean(row.encryptedWebhookSecret) ||
        Boolean(this.config.get('MOYASAR_WEBHOOK_SECRET') as string | undefined),
      currency: (row.currency || 'SAR').toUpperCase(),
      liveMode: row.liveMode,
      status: row.status,
      lastErrorCode: row.lastErrorCode ?? null,
      encryptionReady: this.secrets.configured,
    };
  }

  /** Derive a stable per-order reference the gateway can echo back. */
  static orderReference(orderId: string, tenantId: string): string {
    return createHash('sha256')
      .update(`${tenantId}:${orderId}`)
      .digest('hex')
      .slice(0, 32);
  }

  /** Never let a non-owner read or mutate an order. */
  assertOwnership(order: { tenantId: string; userId: string }, tenantId: string, userId: string): void {
    if (String(order.tenantId) !== String(tenantId)) throw new ForbiddenException('Order access denied');
    if (String(order.userId) !== String(userId)) throw new ForbiddenException('Order access denied');
  }
}
