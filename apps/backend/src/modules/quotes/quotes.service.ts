import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { quotes, QUOTE_STATUSES, type QuoteStatus } from '../../database/schema/quotes';
import { productsBundle, productVariants } from '../../database/schema/products';
import { NotificationsService } from '../notifications/notifications.service';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** How many requests one email may have open against one product before it is ignored. */
const MAX_OPEN_PER_EMAIL_PER_PRODUCT = 3;

export interface CreateQuoteInput {
  tenantId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  name: string;
  email: string;
  company?: string | null;
  message?: string | null;
  quantity?: number | null;
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private drizzle: DrizzleService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Record a quote request.
   *
   * This endpoint is anonymous — a prospective customer has no account — so it is the one
   * write path on the site an outsider can reach. Three guards, cheapest first:
   *
   *   * a per-email cap on *open* requests for the same product, so a stuck form or a
   *     retry loop cannot flood an admin's inbox;
   *   * the product is resolved and its `pricingMode` confirmed to be `request`, so a
   *     stale tab cannot turn a published price into a quote row;
   *   * nothing the buyer sends is trusted as an identifier — the product and variant are
   *     resolved server-side and the tenant comes from the request context.
   */
  async create(input: CreateQuoteInput) {
    const name = String(input.name ?? '').trim();
    const email = String(input.email ?? '').trim().toLowerCase();
    const company = String(input.company ?? '').trim();
    const message = String(input.message ?? '').trim();

    if (name.length < 2) throw new BadRequestException('Please give a name');
    if (!EMAIL.test(email)) throw new BadRequestException('Please give a valid email address');

    let productId: string | null = null;
    let variantId: string | null = null;
    let productTitle: string | null = null;

    if (input.productId) {
      const rows = await this.drizzle.db
        .select({
          id: productsBundle.id,
          title: productsBundle.title,
          pricingMode: productsBundle.pricingMode,
          tenantId: productsBundle.tenantId,
        })
        .from(productsBundle)
        .where(eq(productsBundle.id, input.productId))
        .limit(1);

      const product = rows[0];
      if (!product) throw new NotFoundException('Product not found');
      // A request may only reference a product in the tenant that received it.
      // Without this, anyone could post a productId from another tenant and have
      // that product's title delivered to the wrong admins.
      if (input.tenantId && String(product.tenantId) !== String(input.tenantId)) {
        throw new NotFoundException('Product not found');
      }
      // A product that shows a price is not a quote request. If the tab was stale, the
      // buyer was looking at a page that no longer applies.
      if (product.pricingMode !== 'request') {
        throw new BadRequestException('This product is not quoted on request');
      }
      productId = product.id;
      productTitle = product.title;
      // Confirm the variant belongs to THIS product. Accepting the buyer's value
      // unchecked would let a request reference a variant of some other product.
      if (input.variantId) {
        const variant = await this.drizzle.db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, product.id)))
          .limit(1);
        if (variant[0]) variantId = variant[0].id;
      }
    }

    if (productId) {
      const open = await this.drizzle.db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes)
        .where(
          and(
            eq(quotes.productId, productId),
            eq(quotes.email, email),
            sql`${quotes.status} <> 'closed'`,
          ),
        );
      if ((open[0]?.count ?? 0) >= MAX_OPEN_PER_EMAIL_PER_PRODUCT) {
        throw new BadRequestException(
          'You already have an open quote request for this product. We will be in touch.',
        );
      }
    }

    const [quote] = await this.drizzle.db
      .insert(quotes)
      .values({
        name,
        email,
        company,
        message: message || null,
        tenantId: input.tenantId ?? null,
        productId,
        variantId,
        status: 'new',
      })
      .returning();

    if (!quote) throw new BadRequestException('Could not record the quote request');

    /**
     * Notify the tenant's admins, in-app and by email.
     *
     * Scoped to the tenant rather than to super admins: a quote is that tenant's business.
     * `email: true` means it reaches someone who is not looking at the console that day —
     * without it a request can sit unseen for a week.
     *
     * Failures are swallowed on purpose: the row is the record of truth, and losing it to
     * a mail outage would be worse than a missed notification.
     */
    if (quote.tenantId) {
      try {
        await this.notifications.notifyTenantAdmins(quote.tenantId, {
          type: 'quote.requested',
          // Commerce is the category the notification preferences and the
          // notification item renderer understand. `sales` fell through to the
          // generic system bucket, so the request looked like an operational
          // warning instead of a sales lead.
          category: 'commerce',
          title: 'New quote request',
          body: productTitle
            ? `${name} (${company || email}) asked about ${productTitle}`
            : `${name} (${company || email}) sent a quote request`,
          email: true,
          href: `/admin/quotes`,
          entityType: 'quote',
          entityId: quote.id,
        });
      } catch (error) {
        this.logger.warn(`Quote ${quote.id} saved but admin notification failed`, error);
      }
    }

    return quote;
  }

  /** Admin inbox. Newest first, optionally narrowed to one status or a search term. */
  async listForAdmin(
    tenantId: string,
    opts: { status?: string; search?: string; limit?: number; offset?: number } = {},
  ) {
    const filters = [eq(quotes.tenantId, tenantId)];
    if (opts.status && opts.status !== 'all') filters.push(eq(quotes.status, opts.status));
    if (opts.search) {
      const term = `%${opts.search}%`;
      filters.push(
        or(ilike(quotes.name, term), ilike(quotes.email, term), ilike(quotes.company, term))!,
      );
    }

    const rows = await this.drizzle.db
      .select()
      .from(quotes)
      .where(and(...filters))
      .orderBy(desc(quotes.createdAt))
      .limit(Math.min(opts.limit ?? 50, 200))
      .offset(opts.offset ?? 0);

    const counts = await this.drizzle.db
      .select({ status: quotes.status, count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.tenantId, tenantId))
      .groupBy(quotes.status);

    const byStatus: Record<string, number> = { new: 0, contacted: 0, closed: 0 };
    for (const c of counts) byStatus[c.status] = c.count;

    return { items: rows, total: rows.length, counts: byStatus };
  }

  /** Advance a request. Only the workflow fields are writable. */
  async updateForAdmin(
    tenantId: string,
    id: string,
    patch: { status?: string; adminNote?: string | null; quotedPrice?: number | null },
  ) {
    const values: Record<string, unknown> = { updatedAt: new Date() };

    if (patch.status !== undefined) {
      const status = String(patch.status).trim().toLowerCase();
      if (!(QUOTE_STATUSES as readonly string[]).includes(status)) {
        throw new BadRequestException(`status must be one of: ${QUOTE_STATUSES.join(', ')}`);
      }
      values.status = status as QuoteStatus;
    }
    if (patch.adminNote !== undefined) values.adminNote = patch.adminNote;
    if (patch.quotedPrice !== undefined) {
      const price = patch.quotedPrice === null ? null : Number(patch.quotedPrice);
      if (price !== null && (!Number.isInteger(price) || price < 0)) {
        throw new BadRequestException('quotedPrice must be a non-negative integer in minor units');
      }
      values.quotedPrice = price;
    }

    const updated = await this.drizzle.db
      .update(quotes)
      .set(values)
      .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
      .returning();

    if (!updated[0]) throw new NotFoundException('Quote request not found');
    return updated[0];
  }
}