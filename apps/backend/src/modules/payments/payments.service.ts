import { Injectable, Inject, Optional, BadRequestException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { ConfigService } from '../../config/config.service';
import { DrizzleService } from '../../database/drizzle.service';
import { orders, orderItems } from '../../database/schema/orders';
import { productsBundle, productVariants } from '../../database/schema/products';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private stripe: any = null;
  private readonly logger = new Logger(PaymentsService.name);
  // In-memory fallback for webhook idempotency if Redis unavailable
  private processedEvents = new Map<string, number>();

  constructor(
    @Inject(ConfigService) private config: ConfigService,
    private drizzle: DrizzleService,
    @Optional() @Inject('REDIS_CLIENT') private redisClient?: any,
    @Optional() private notifications?: NotificationsService,
  ) {
    const key = this.config.get('STRIPE_SECRET_KEY');
    if (key) {
      try {
        // Deliberately a lazy require, not a static import: the Stripe SDK is heavy and
        // is only needed when a key is actually configured. A static import would pull
        // it into every boot, including the common case where checkout runs the stub.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        this.stripe = new (require('stripe'))(key);
        this.logger.log('Stripe initialized in live mode');
      } catch (e) {
        this.logger.warn(`Stripe init failed: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — checkout will use stub fallback');
    }
  }

  private isLive(): boolean {
    return !!this.stripe;
  }

  private notifyOrder(order: typeof orders.$inferSelect, type: string, title: string, body: string) {
    void this.notifications?.notifyUser({
      tenantId: order.tenantId,
      userId: order.userId,
      type,
      category: 'commerce',
      title,
      body,
      href: `/checkout/success?orderId=${order.id}`,
      entityType: 'order',
      entityId: order.id,
      idempotencyKey: `${type}:${order.tenantId}:${order.id}`,
    }).catch(() => {});
    void this.notifications?.notifyTenantAdmins(order.tenantId, {
      type: `${type}_staff`,
      category: 'commerce',
      title,
      body,
      href: `/admin/finance?orderId=${order.id}`,
      entityType: 'order',
      entityId: order.id,
      idempotencyKey: `${type}:${order.tenantId}:${order.id}:staff`,
    }).catch(() => {});
  }

  private async checkIdempotency(eventId: string): Promise<boolean> {
    // Return true if already processed (should skip)
    const now = Date.now();
    // Clean old entries
    for (const [k, v] of this.processedEvents) if (now - v > 24 * 60 * 60 * 1000) this.processedEvents.delete(k);

    if (this.processedEvents.has(eventId)) return true;

    // P1: Redis is required for distributed idempotency in live mode
    if (this.redisClient) {
      try {
        // Use SET NX with TTL 24h
        const res = await this.redisClient.set(`stripe:event:${eventId}`, '1', 'NX', 'EX', 86400);
        if (res === null) return true; // already exists
        this.processedEvents.set(eventId, now);
        return false;
      } catch (e) {
        this.logger.warn(`Redis idempotency check failed for ${eventId}: ${(e as Error).message} — falling back to in-memory (not distributed)`);
      }
    } else if (this.isLive()) {
      this.logger.warn(`Redis unavailable for webhook idempotency in live mode — using in-memory fallback for ${eventId} (duplicate may occur across instances)`);
    }

    this.processedEvents.set(eventId, now);
    return false;
  }

  async createCheckout(params: {
    tenantId: string; userId: string;
    items: {
      productId: string; variantId?: string; title?: string;
      variantTitle?: string; sku?: string; price?: number;
      quantity: number; thumbnailUrl?: string; isDigital?: boolean; isBackordered?: boolean;
      /** Lowercase ISO code taken from the product row, never from the client. */
      currency?: string;
    }[];
    successUrl: string; cancelUrl: string;
  }) {
    if (!params.items || params.items.length === 0) throw new BadRequestException('No items');

    // Tenant isolation + product validation
    const validatedItems: typeof params.items = [];
    for (const item of params.items) {
      if (!item.productId) throw new BadRequestException('Missing productId');
      const [prodRow] = await this.drizzle.db.select().from(productsBundle).where(and(eq(productsBundle.id, item.productId), eq(productsBundle.tenantId, params.tenantId))).limit(1);
      if (!prodRow) throw new BadRequestException(`Product ${item.productId} not found for tenant`);
      if (!prodRow.isPublished) throw new BadRequestException(`Product ${prodRow.title} not published`);
      // Resolve price: variant price > product price > item.price
      let price = prodRow.price;
      let title = prodRow.title;
      let sku: string | undefined = undefined;
      const isDigital = prodRow.isDigital ?? false;
      if (item.variantId) {
        const variant = await this.drizzle.db.select().from(productVariants).where(eq(productVariants.id, item.variantId)).then(r => r[0]);
        if (!variant || variant.productId !== item.productId) throw new BadRequestException('Variant not found');
        if (variant.price) price = variant.price;
        sku = variant.sku ?? undefined;
        title = prodRow.title;
      }
      // Client-supplied price must match DB price to prevent tampering
      if (item.price && item.price !== price) {
        this.logger.warn(`Price mismatch for ${item.productId}: client ${item.price} vs db ${price} — using DB price`);
      }
      validatedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        title,
        variantTitle: item.variantTitle,
        sku,
        price,
        currency: (prodRow.currency || this.config.get('PAYMENTS_CURRENCY')).toLowerCase(),
        quantity: item.quantity,
        thumbnailUrl: item.thumbnailUrl ?? prodRow.thumbnailUrl ?? undefined,
        isDigital,
        isBackordered: item.isBackordered,
      });
    }

    const subtotal = validatedItems.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
    const shipping = subtotal >= 5000 ? 0 : 999;
    const total = subtotal + shipping;
    // The charge must use the currency the stored prices are actually denominated
    // in. Charging a SAR amount as USD would silently triple the invoice, so the
    // order records the product currency and each Stripe line carries its own.
    const currencies = [...new Set(validatedItems.map((i) => i.currency!))];
    const settlementCurrency = currencies[0] ?? this.config.get('PAYMENTS_CURRENCY');
    if (currencies.length > 1) {
      this.logger.warn(`Mixed-currency order ${currencies.join(',')} — each line is charged in its own currency`);
    }

    const [order] = await this.drizzle.db.insert(orders).values({
      tenantId: params.tenantId,
      userId: params.userId,
      status: 'pending',
      subtotal,
      shipping,
      total,
      currency: settlementCurrency.toUpperCase(),
    }).returning();
    if (!order) throw new Error('Failed to create order');

    for (const item of validatedItems) {
      await this.drizzle.db.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        variantTitle: item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        thumbnailUrl: item.thumbnailUrl,
        isDigital: item.isDigital,
        isBackordered: item.isBackordered,
      } as any);
    }

    this.notifyOrder(order, 'order_created', 'Order created', 'Your order has been created.');

    if (this.isLive()) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: validatedItems.map((i) => ({
            price_data: {
              currency: i.currency ?? settlementCurrency,
              product_data: { name: i.variantTitle ? `${i.title} - ${i.variantTitle}` : i.title, metadata: { productId: i.productId } },
              unit_amount: i.price,
            },
            quantity: i.quantity,
          })),
          metadata: { orderId: order.id, tenantId: params.tenantId, userId: params.userId },
          success_url: params.successUrl.includes('{CHECKOUT_SESSION_ID}') ? params.successUrl : `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: params.cancelUrl,
          client_reference_id: order.id,
        });

        await this.drizzle.db.update(orders)
          .set({ stripeSessionId: session.id })
          .where(eq(orders.id, order.id));

        return { url: session.url, sessionId: session.id, orderId: order.id };
      } catch (e: any) {
        this.logger.error(`Stripe session creation failed in live mode: ${e.message}`);
        // P1: No silent stub success in production — fail loudly so client can retry
        // Clean up pending order to avoid orphan? Keep pending for manual investigation.
        throw new BadRequestException(`Checkout failed: ${e.message}`);
      }
    }

    // Stub mode only when Stripe not configured (dev/test).
    // NOTE: this used to return `/checkout/confirm?orderId=…` — a route that does not
    // exist in the frontend, so every dev checkout dead-ended in a 404 AFTER the order
    // row had already been written. Point at the real confirmation page instead, and
    // flag the mode so the UI can be honest that no payment was collected.
    return {
      url: `/checkout/success?orderId=${order.id}`,
      orderId: order.id,
      mode: 'stub',
      paymentCollected: false,
      message: 'Payment provider is not configured — order recorded but no payment was taken.',
    };
  }

  async handleWebhook(rawBody: string | Buffer, signature: string) {
    if (!this.isLive()) {
      this.logger.warn('Webhook received but Stripe not configured — ignoring');
      return { received: true, live: false };
    }
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new BadRequestException('Webhook secret not configured');

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Idempotency
    if (await this.checkIdempotency(event.id)) {
      this.logger.log(`Duplicate webhook ${event.id} (${event.type}) — skipping`);
      return { received: true, duplicate: true };
    }

    const tenantIdFromMeta = event.data?.object?.metadata?.tenantId as string | undefined;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { id: string; payment_intent: string; metadata?: { orderId?: string; tenantId?: string }; client_reference_id?: string };
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (!orderId) {
          this.logger.warn(`checkout.session.completed without orderId: ${session.id}`);
          break;
        }
        // Tenant-scoped update — only from pending, no confirmation without verified orderId+tenant match
        const where = tenantIdFromMeta ? and(eq(orders.id, orderId), eq(orders.tenantId, tenantIdFromMeta), eq(orders.status, 'pending')) : and(eq(orders.id, orderId), eq(orders.status, 'pending'));
        // Also ensure stripeSessionId matches to prevent spoofed metadata
        const whereWithSession = tenantIdFromMeta
          ? and(eq(orders.id, orderId), eq(orders.tenantId, tenantIdFromMeta), eq(orders.stripeSessionId, session.id), eq(orders.status, 'pending'))
          : and(eq(orders.id, orderId), eq(orders.stripeSessionId, session.id), eq(orders.status, 'pending'));

        const updated = await this.drizzle.db.update(orders)
          .set({
            status: 'confirmed',
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          })
          .where(whereWithSession)
          .returning();

        if (updated.length === 0) {
          // Fallback: try without session check but still tenant-scoped + pending (for stub sessions in non-live mode)
          if (!this.isLive()) {
            await this.drizzle.db.update(orders)
              .set({ status: 'confirmed', stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined })
              .where(where as any);
          } else {
            this.logger.warn(`Order ${orderId} not confirmed — status not pending or session mismatch for ${session.id}`);
          }
        }
        if (updated[0]) {
          this.notifyOrder(updated[0], 'order_confirmed', 'Payment confirmed', 'Your payment was confirmed and your order is being processed.');
        }
        this.logger.log(`Order ${orderId} confirmed via ${session.id} tenant=${tenantIdFromMeta}`);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as { id: string; metadata?: { orderId?: string; tenantId?: string }; client_reference_id?: string };
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (orderId) {
          const where = tenantIdFromMeta ? and(eq(orders.id, orderId), eq(orders.tenantId, tenantIdFromMeta), eq(orders.status, 'pending')) : and(eq(orders.id, orderId), eq(orders.status, 'pending'));
          const r = await this.drizzle.db.update(orders).set({ status: 'expired' }).where(where as any).returning();
          if (r.length) {
            this.notifyOrder(r[0]!, 'order_expired', 'Order expired', 'Your checkout session expired before payment was completed.');
            this.logger.log(`Order ${orderId} expired`);
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as { id: string; metadata?: { orderId?: string; tenantId?: string } };
        // Only mark pending orders as failed
        if (pi.id) {
          const r = await this.drizzle.db.update(orders).set({ status: 'failed' }).where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.status, 'pending'))).returning();
          if (r.length) {
            this.notifyOrder(r[0]!, 'payment_failed', 'Payment failed', 'Your payment could not be completed. Please try again.');
            this.logger.log(`Payment ${pi.id} failed`);
          }
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
        break;
    }

    return { received: true };
  }

  async getOrder(tenantId: string, userId: string, orderId: string) {
    const [order] = await this.drizzle.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId), eq(orders.userId, userId))).limit(1);
    if (!order) throw new BadRequestException('Order not found');
    const items = await this.drizzle.db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return { ...order, items };
  }

  async getOrderBySession(sessionId: string, tenantId: string, userId?: string) {
    const where = userId ? and(eq(orders.stripeSessionId, sessionId), eq(orders.tenantId, tenantId), eq(orders.userId, userId)) : and(eq(orders.stripeSessionId, sessionId), eq(orders.tenantId, tenantId));
    const [order] = await this.drizzle.db.select().from(orders).where(where as any).limit(1);
    if (!order) throw new BadRequestException('Order not found');
    const items = await this.drizzle.db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return { ...order, items };
  }
}
