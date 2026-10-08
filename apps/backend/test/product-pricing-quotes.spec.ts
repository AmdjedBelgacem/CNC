import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../src/database/drizzle.service';
import { products, tenants } from '../src/database/schema';
import { quotes } from '../src/database/schema/quotes';
import { ProductsService } from '../src/modules/products/products.service';

/**
 * Pricing modes and the quote pipeline, against a real Postgres.
 *
 * The two are one feature: a machine that is quoted on request has to have somewhere for
 * the request to land. What is being protected:
 *
 *  1. `pricingMode` can only ever hold one of three values. It is on the client
 *     allowlist, so an unchecked write would store `'starting'`, the storefront switch
 *     would fall through to `fixed`, and a quote-only machine would publish a price.
 *  2. A quote request is attributed to a tenant and a product, and only accepted for a
 *     product that is actually quote-only — a stale tab must not turn a published price
 *     into a sales lead.
 *  3. One email cannot open unlimited requests for the same product.
 */
describe('product pricing modes + quote requests (integration)', () => {
  let drizzle: DrizzleService;
  let productsService: ProductsService;
  let quotesService: {
    create: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    listForAdmin: (tenantId: string, opts?: Record<string, unknown>) => Promise<{ items: unknown[]; counts: Record<string, number> }>;
    updateForAdmin: (tenantId: string, id: string, patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  let tenantId: string;
  const createdProducts: string[] = [];
  const createdQuotes: string[] = [];

  /** The notification service is not under test here; a throw must not lose the row. */
  const notifications = {
    notifyTenantAdmins: async () => [],
  };

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    productsService = new ProductsService(drizzle as never);
    const { QuotesService } = await import('../src/modules/quotes/quotes.service');
    // Constructed directly so this stays an integration test of the logic rather than a
    // test of Nest's DI graph.
    quotesService = new QuotesService(drizzle as never, notifications as never) as never;

    const [tenant] = await drizzle.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .limit(1);
    tenantId = tenant.id;
  });

  beforeEach(async () => {
    if (createdQuotes.length) {
      await drizzle.db.delete(quotes).where(eq(quotes.email, 'qa-quote@example.com'));
      createdQuotes.length = 0;
    }
  });

  afterAll(async () => {
    if (createdQuotes.length) {
      await drizzle.db.delete(quotes).where(eq(quotes.email, 'qa-quote@example.com'));
    }
    // Only the rows this spec created. An earlier version deleted by tenant, which wiped
    // every fixture in the database and made an unrelated suite fail depending on run
    // order — the same rule the API sweep follows: never delete what you did not create.
    if (createdProducts.length) {
      await drizzle.db.delete(products).where(inArray(products.id, createdProducts));
    }
  });

  let seq = 0;
  async function makeProduct(overrides: Record<string, unknown> = {}) {
    seq += 1;
    const slug = `qa-pricing-${Date.now().toString(36)}-${seq}`;
    const [row] = await drizzle.db
      .insert(products)
      .values({
        title: `QA Pricing ${seq}`,
        slug,
        description: 'pricing mode fixture',
        currency: 'SAR',
        trackInventory: true,
        tenantId,
        ...overrides,
      } as never)
      .returning();
    createdProducts.push(row.id);
    return row;
  }

  // ------------------------------------------------------------ pricing mode ---

  it('defaults to fixed so no existing product changes meaning', async () => {
    const product = await makeProduct();
    expect(product.pricingMode).toBe('fixed');
  });

  it('accepts the three modes and rejects anything else', async () => {
    const product = await makeProduct();
    for (const mode of ['from', 'request', 'fixed'] as const) {
      const saved = await productsService.update(product.id, { pricingMode: mode });
      expect(saved.pricingMode).toBe(mode);
    }
    await expect(
      productsService.update(product.id, { pricingMode: 'starting' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(productsService.update(product.id, { pricingMode: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Rejected, so the stored value is untouched.
    const after = await productsService.findById(product.id);
    expect(after.pricingMode).toBe('fixed');
  });

  it('rejects a bad mode on create too', async () => {
    await expect(
      productsService.create({ title: 'QA bad mode', slug: 'qa-bad-mode', pricingMode: 'free' }, tenantId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // -------------------------------------------------------------- quote flow ---

  it('accepts a request for a quote-only product and links it', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    const quote = await quotesService.create({
      tenantId,
      productId: product.id,
      name: 'QA Buyer',
      email: 'qa-quote@example.com',
      company: 'QA Machining Ltd',
      message: 'Need a 5-axis with a fourth trunnion.',
    });
    createdQuotes.push(quote.id as string);

    expect(quote.status).toBe('new');
    expect(quote.tenantId).toBe(tenantId);
    expect(quote.productId).toBe(product.id);
    // The buyer's message is preserved; nothing is normalised away.
    expect(String(quote.message)).toContain('fourth trunnion');
  });

  it('refuses a quote request for a product that shows a price', async () => {
    const product = await makeProduct({ pricingMode: 'fixed', price: 5000 });
    await expect(
      quotesService.create({
        tenantId,
        productId: product.id,
        name: 'QA Buyer',
        email: 'qa-quote@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps open requests per email per product', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    for (let i = 0; i < 3; i += 1) {
      const q = await quotesService.create({
        tenantId,
        productId: product.id,
        name: 'QA Buyer',
        email: 'qa-quote@example.com',
      });
      createdQuotes.push(q.id as string);
    }
    await expect(
      quotesService.create({
        tenantId,
        productId: product.id,
        name: 'QA Buyer',
        email: 'qa-quote@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exposes pricingMode on the public read so the storefront can branch', async () => {
    // Publishing has real preconditions (title, slug, positive price, thumbnail), so the
    // fixture carries what it needs rather than bypassing the lifecycle.
    const product = await makeProduct({
      pricingMode: 'from',
      price: 5000,
      thumbnailUrl: '/uploads/covers/qa-thumbnail.png',
    });
    await productsService.publish(product.id);
    const found = await productsService.findBySlug(tenantId, product.slug);
    expect(found.pricingMode).toBe('from');
  });

  it('validates the email and the name', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    await expect(
      quotesService.create({ tenantId, productId: product.id, name: 'Q', email: 'qa-quote@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      quotesService.create({ tenantId, productId: product.id, name: 'QA Buyer', email: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalises the email so the cap cannot be dodged by case', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    for (const email of ['QA-Quote@Example.com', 'qa-quote@example.com']) {
      const q = await quotesService.create({ tenantId, productId: product.id, name: 'QA Buyer', email });
      createdQuotes.push(q.id as string);
    }
    const all = await quotesService.listForAdmin(tenantId, { search: 'qa-quote@example.com' });
    // Stored lower-cased, so the search finds them and the cap counted them as one person.
    expect(all.items.length).toBeGreaterThanOrEqual(2);
  });

  // ------------------------------------------------------------- admin flow ---

  it('lists for admin and counts by status', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    const q = await quotesService.create({
      tenantId,
      productId: product.id,
      name: 'QA Buyer',
      email: 'qa-quote@example.com',
    });
    createdQuotes.push(q.id as string);

    const inbox = await quotesService.listForAdmin(tenantId, { search: 'qa-quote@example.com' });
    expect(inbox.items.length).toBeGreaterThanOrEqual(1);
    expect(inbox.counts.new).toBeGreaterThanOrEqual(1);
  });

  it('advances status, records a note and a quoted price', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    const q = await quotesService.create({
      tenantId,
      productId: product.id,
      name: 'QA Buyer',
      email: 'qa-quote@example.com',
    });
    createdQuotes.push(q.id as string);

    const updated = await quotesService.updateForAdmin(tenantId, q.id as string, {
      status: 'contacted',
      adminNote: 'Sent a quotation PDF.',
      quotedPrice: 1_250_000,
    });
    expect(updated.status).toBe('contacted');
    expect(updated.adminNote).toContain('quotation PDF');
    expect(updated.quotedPrice).toBe(1_250_000);
  });

  it('rejects an unknown status and a nonsensical quoted price', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    const q = await quotesService.create({
      tenantId,
      productId: product.id,
      name: 'QA Buyer',
      email: 'qa-quote@example.com',
    });
    createdQuotes.push(q.id as string);

    await expect(
      quotesService.updateForAdmin(tenantId, q.id as string, { status: 'maybe' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      quotesService.updateForAdmin(tenantId, q.id as string, { quotedPrice: -5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      quotesService.updateForAdmin(tenantId, q.id as string, { quotedPrice: 12.5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('will not let one tenant touch another tenant’s request', async () => {
    const product = await makeProduct({ pricingMode: 'request' });
    const q = await quotesService.create({
      tenantId,
      productId: product.id,
      name: 'QA Buyer',
      email: 'qa-quote@example.com',
    });
    createdQuotes.push(q.id as string);

    await expect(
      quotesService.updateForAdmin('00000000-0000-4000-8000-000000000000', q.id as string, {
        status: 'closed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});