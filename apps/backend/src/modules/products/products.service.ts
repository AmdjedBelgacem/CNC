import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { localizeProductFields, resolveContentLocale } from '../courses/lesson-content';
import { DrizzleService } from '../../database/drizzle.service';
import { productsBundle, productVariants, productImages } from '../../database/schema/products';
import { eq, and, asc, desc, like, count, inArray, sql } from 'drizzle-orm';
import type { InteractiveHotspot } from '@titan/shared';
import { SearchService } from '../search/search.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class ProductsService {
  constructor(
    private drizzle: DrizzleService,
    private search?: SearchService,
    private storage?: StorageService,
    private config?: ConfigService,
  ) {}

  private syncSearch(tenantId: string, id: string) {
    void this.search?.indexEntity(tenantId, 'product', id);
  }

  private get q() { return this.drizzle.db.query; }
  private get db() { return this.drizzle.db; }

  async findByTenant(
    tenantId: string,
    opts?: {
      category?: string; featured?: boolean; search?: string;
      page?: number; limit?: number;
      academyId?: string; courseId?: string;
      /** Request or explicit locale; the resolver also reads the cookie/header. */
      localeInput?: unknown;
    },
  ) {
    const conditions: any[] = [eq(productsBundle.tenantId, tenantId)];
    if (opts?.featured) conditions.push(eq(productsBundle.featured, true));
    if (opts?.category) conditions.push(eq(productsBundle.category, opts.category));
    if (opts?.search) {
      conditions.push(
        sql`(${like(productsBundle.title, `%${opts.search}%`)} or ${sql`${productsBundle.translations}::text`} ilike ${`%${opts.search}%`})`,
      );
    }
    if (opts?.academyId) conditions.push(eq(productsBundle.academyId, opts.academyId));
    if (opts?.courseId) conditions.push(eq(productsBundle.courseId, opts.courseId));
    conditions.push(eq(productsBundle.isPublished, true));
    conditions.push(eq(productsBundle.isArchived, false));

    const page = opts?.page || 1;
    const limit = opts?.limit || 20;

    const data = await this.q.products.findMany({
      where: and(...conditions),
      orderBy: [asc(productsBundle.sortOrder), desc(productsBundle.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: { variants: { orderBy: asc(productVariants.sortOrder) } },
    });

    const totalArr = await this.db
      .select({ count: count() })
      .from(productsBundle)
      .where(and(...conditions));

    // Arabic shoppers search in Arabic, so the free-text filter has to look at the
    // translation column too, or an Arabic query returns nothing.
    const locale = resolveContentLocale(opts?.localeInput);
    return {
      data: data.map((row) => localizeProductFields(row as Record<string, any>, locale).value),
      total: totalArr[0]?.count || 0,
      page,
      limit,
      locale,
    };
  }

  async findBySlug(tenantId: string, slug: string, localeInput?: unknown) {
    const product = await this.q.products.findFirst({
      where: and(eq(productsBundle.tenantId, tenantId), eq(productsBundle.slug, slug)),
      with: { variants: { orderBy: asc(productVariants.sortOrder) } },
    });
    if (!product) throw new NotFoundException('Product not found');
    // No locale argument means an internal/admin read: hand back the raw row.
    if (localeInput === undefined) return product;
    return localizeProductFields(product as Record<string, any>, resolveContentLocale(localeInput)).value;
  }

  async findById(id: string) {
    const product = await this.q.products.findFirst({
      where: eq(productsBundle.id, id),
      with: { variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findRelated(tenantId: string, productId: string, limit = 6) {
    const product = await this.findById(productId);
    const tags = (product.tags || []) as string[];
    if (tags.length === 0) {
      const result = await this.findByTenant(tenantId, { limit });
      return result.data;
    }
    const related = await this.q.products.findMany({
      where: and(
        eq(productsBundle.tenantId, tenantId),
        eq(productsBundle.isPublished, true),
        eq(productsBundle.isArchived, false),
        inArray(productsBundle.tags as any, tags as any),
      ),
      limit,
    });
    return related.filter((p) => p.id !== productId).slice(0, limit);
  }

  async findByCourseTags(tenantId: string, tags: string[], limit = 8) {
    if (!tags?.length) return [];
    return this.q.products.findMany({
      where: and(
        eq(productsBundle.tenantId, tenantId),
        eq(productsBundle.isPublished, true),
        eq(productsBundle.isArchived, false),
        inArray(productsBundle.tags as any, tags as any),
      ),
      limit,
    });
  }

  async checkAvailability(productId: string, quantity: number, variantId?: string) {
    if (variantId) {
      const variant = await this.q.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
      });
      if (!variant) return { available: false, reason: 'Variant not found' };
      if ((variant.inventory ?? 0) >= quantity) return { available: true };
      if (variant.allowBackorder) return { available: true, backorder: true };
      return { available: false, reason: 'Out of stock' };
    }
    const product = await this.findById(productId);
    if ((product.inventory ?? 0) >= quantity) return { available: true };
    if (product.allowBackorder) return { available: true, backorder: true, leadDays: product.backorderLeadDays };
    return { available: false, reason: 'Out of stock' };
  }

  async findByAcademy(tenantId: string, academyId: string, limit = 20) {
    return this.q.products.findMany({
      where: and(
        eq(productsBundle.tenantId, tenantId),
        eq(productsBundle.academyId, academyId),
        eq(productsBundle.isPublished, true),
        eq(productsBundle.isArchived, false),
      ),
      orderBy: [asc(productsBundle.sortOrder), desc(productsBundle.createdAt)],
      limit,
      with: { variants: { orderBy: asc(productVariants.sortOrder) } },
    });
  }

  async findByCourse(tenantId: string, courseId: string, limit = 20) {
    return this.q.products.findMany({
      where: and(
        eq(productsBundle.tenantId, tenantId),
        eq(productsBundle.courseId, courseId),
        eq(productsBundle.isPublished, true),
        eq(productsBundle.isArchived, false),
      ),
      orderBy: [asc(productsBundle.sortOrder), desc(productsBundle.createdAt)],
      limit,
      with: { variants: { orderBy: asc(productVariants.sortOrder) } },
    });
  }

  async adminList(
    tenantId: string,
    opts?: {
      search?: string; status?: string; academyId?: string; courseId?: string;
      category?: string; page?: number; limit?: number;
    },
  ) {
    // Shared, status-agnostic filters. The status facet counts reuse these so a
    // tab can report how many products it would yield.
    const baseConditions: any[] = [eq(productsBundle.tenantId, tenantId)];
    if (opts?.search) {
      baseConditions.push(
        sql`(${like(productsBundle.title, `%${opts.search}%`)} or ${sql`${productsBundle.translations}::text`} ilike ${`%${opts.search}%`})`,
      );
    }
    if (opts?.academyId) baseConditions.push(eq(productsBundle.academyId, opts.academyId));
    if (opts?.courseId) baseConditions.push(eq(productsBundle.courseId, opts.courseId));
    if (opts?.category) baseConditions.push(eq(productsBundle.category, opts.category));

    const statusConditions = (status?: string): any[] => {
      if (status === 'published') {
        return [eq(productsBundle.isPublished, true), eq(productsBundle.isArchived, false)];
      }
      if (status === 'draft') {
        return [eq(productsBundle.isPublished, false), eq(productsBundle.isArchived, false)];
      }
      if (status === 'archived') {
        return [eq(productsBundle.isArchived, true)];
      }
      return [];
    };

    const conditions = [...baseConditions, ...statusConditions(opts?.status)];

    const page = opts?.page || 1;
    const limit = opts?.limit || 20;

    const data = await this.q.products.findMany({
      where: and(...conditions),
      orderBy: [asc(productsBundle.sortOrder), desc(productsBundle.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: {
        variants: { orderBy: asc(productVariants.sortOrder) },
        academy: { columns: { id: true, title: true, slug: true } },
        course: { columns: { id: true, title: true, slug: true } },
      },
    });

    const [totalArr, facetRows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(productsBundle)
        .where(and(...conditions)),
      // Counts per status across the whole filtered set, not just this page, so
      // the admin headline cards and filter tabs are accurate.
      Promise.all([
        ...(['published', 'draft', 'archived'] as const).map((st) =>
          this.db
            .select({ count: count() })
            .from(productsBundle)
            .where(and(...baseConditions, ...statusConditions(st)))
            .then((r) => [st, Number(r[0]?.count || 0)] as const),
        ),
        // Featured is its own facet; counting it on the page alone would make
        // the header number wrong as soon as the catalogue spans two pages.
        this.db
          .select({ count: count() })
          .from(productsBundle)
          .where(and(...baseConditions, eq(productsBundle.featured, true)))
          .then((r) => ['featured', Number(r[0]?.count || 0)] as const),
      ]),
    ]);

    const facets: Record<string, number> = {
      published: 0,
      draft: 0,
      archived: 0,
      featured: 0,
    };
    let facetTotal = 0;
    for (const [key, n] of facetRows) {
      facets[key] = n;
      // `featured` is a flag, not a fourth status. Summing it in would double
      // count every featured product and inflate the catalogue total.
      if (key !== 'featured') facetTotal += n;
    }

    return {
      items: data,
      total: totalArr[0]?.count || 0,
      page,
      limit,
      facets,
      facetTotal,
    };
  }

  /**
   * Columns a client may write through POST: exactly the PATCH allowlist, no more.
   *
   * Create used to take the raw request body (`create(data: any)`), so it had none of the
   * protections PATCH had — `title: ''` and `slug: ''` were stored as sent, producing a
   * blank product in the catalog, which is the same class of damage the PATCH allowlist
   * was built to prevent. `tenantId`, `isPublished`, `status` and `role` could also be
   * injected to file a record under another tenant or publish it on arrival.
   *
   * `status` is deliberately NOT writable here even though PATCH lists it: a new product
   * always starts as a draft, and publishing goes through the publish endpoint so the
   * lifecycle stays auditable. The admin "new product" form never sent `status` anyway.
   */
  async create(data: Record<string, unknown>, tenantId: string) {
    const title = typeof data?.title === 'string' ? data.title.trim() : '';
    if (!title) throw new BadRequestException('Title cannot be empty.');
    const slug = typeof data?.slug === 'string' ? data.slug.trim().toLowerCase() : '';
    if (!slug) throw new BadRequestException('Slug cannot be empty.');

    // Same allowlist discipline as PATCH: anything unlisted is dropped, not trusted.
    // `tenantId` is a separate trusted argument rather than a body key, so no payload
    // shape can decide which tenant the record lands in.
    const values: Record<string, unknown> = { tenantId };
    for (const key of Object.keys(ProductsService.UPDATABLE)) {
      if (data[key] !== undefined) values[key] = data[key];
    }
    // Assigned after the copy loop: `slug` is in the allowlist, so letting the loop run
    // last would put the untrimmed original straight back over the normalised value.
    values.title = title;
    values.slug = slug;

    const [product] = await this.db.insert(productsBundle).values(values as never).returning();
    if (product) this.syncSearch(product.tenantId, product.id);
    return product;
  }

  /**
   * Columns a client may ever write through PATCH.
   *
   * This is a strict allowlist, and it is the second half of the data-loss fix. The
   * endpoint previously spread the request body straight into the UPDATE, which meant
   * (a) any key the client sent — including nulls for fields it had simply never loaded
   * — overwrote the row, and (b) `tenantId`, `id`, `createdAt` and `isPublished` were
   * all writable, so one request could move a product to another tenant or self-publish
   * it. Anything not listed here is ignored rather than trusted.
   */
  private static readonly UPDATABLE: Record<string, true> = {
    title: true, slug: true, tagline: true, description: true, category: true,
    price: true, compareAtPrice: true, currency: true, trackInventory: true,
    inventory: true, allowBackorder: true, backorderLeadDays: true, isDigital: true,
    featured: true, sortOrder: true, tags: true, features: true,
    thumbnailUrl: true, mediaUrls: true, pinpoints: true, documents: true,
    academyId: true, courseId: true, seoTitle: true, seoDescription: true,
  };

  async update(id: string, data: Record<string, unknown>, expectedUpdatedAt?: string | Date | null) {
    /**
     * Optimistic locking. The client sends the `updatedAt` it loaded; if the row moved
     * underneath it, two admins editing the same product would otherwise silently
     * overwrite each other with no trace. Returns 409 + the current row so the caller
     * can show the conflict instead of clobbering.
     */
    if (expectedUpdatedAt) {
      const current = await this.db
        .select({ updatedAt: productsBundle.updatedAt })
        .from(productsBundle)
        .where(eq(productsBundle.id, id))
        .limit(1);
      if (!current[0]) throw new NotFoundException('Product not found');
      const expected = new Date(expectedUpdatedAt).getTime();
      const actual = new Date(current[0].updatedAt).getTime();
      if (Number.isFinite(expected) && expected !== actual) {
        throw new ConflictException({
          message: 'Product was modified by someone else. Reload to see the current version.',
          code: 'product_conflict',
          currentUpdatedAt: current[0].updatedAt,
        });
      }
    }

    /**
     * Partial-update semantics, stated once so every caller agrees:
     *   - a key that is ABSENT is not mentioned in the UPDATE at all (unchanged);
     *   - a key present with `null` clears that field;
     *   - a key present with `""` or `[]` is a real value and is stored as given.
     *
     * Nothing else is inferred. The old code sent every column on every save, so a
     * form that had not finished loading nulled the entire product.
     */
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data ?? {})) {
      if (ProductsService.UPDATABLE[key]) patch[key] = value;
    }

    /**
     * A product cannot be renamed to nothing.
     *
     * This is a domain rule, not a patch for one bad client: `title` and `slug` are
     * the product's identity, and a row with `slug = ''` is unreachable afterwards —
     * `findBySlug` matches nothing, so the admin list links to a 404 and every further
     * save fails. It is exactly the state the data-loss bug produced.
     *
     * It matters for safety beyond the admin UI: this endpoint is the only thing
     * standing between any client and a product that can never be edited again.
     */
    for (const field of ['title', 'slug'] as const) {
      if (patch[field] === undefined) continue;
      if (typeof patch[field] === 'string' && patch[field].trim() === '') {
        throw new BadRequestException(`${field === 'title' ? 'Title' : 'Slug'} cannot be empty.`);
      }
    }
    if (Object.keys(patch).length === 0) {
      // Nothing editable in the body: return the row untouched rather than issuing a
      // no-op UPDATE, so `updatedAt` does not move and clients can detect no-op saves.
      const existing = await this.db
        .select()
        .from(productsBundle)
        .where(eq(productsBundle.id, id))
        .limit(1);
      if (!existing[0]) throw new NotFoundException('Product not found');
      return existing[0];
    }

    return this.writeRow(id, patch);
  }

  /**
   * Server-side lifecycle write (publish / unpublish / archive / restore).
   *
   * Deliberately separate from `update()`: those columns are off the client allowlist
   * on purpose, and routing them through the filtered path made `publish` a silent
   * no-op — the row came back with `isPublished: false` and no error. A lifecycle
   * change is a decision the server makes, never one a request body can ask for.
   */
  private async applyLifecycle(id: string, values: Record<string, unknown>) {
    return this.writeRow(id, values);
  }

  private async writeRow(id: string, patch: Record<string, unknown>) {
    const [product] = await this.db
      .update(productsBundle).set({ ...patch, updatedAt: new Date() })
      .where(eq(productsBundle.id, id)).returning();
    if (!product) throw new NotFoundException('Product not found');
    this.syncSearch(product.tenantId, product.id);
    return product;
  }

  // ---------------------------------------------------------------- images ---

  /** Gallery cap. Kept small so the storefront never ships a 40-image carousel. */
  static readonly MAX_IMAGES = 12;

  /** Per image. A hotspot is a point plus a label, so a lot of them is noise, not detail. */
  static readonly MAX_HOTSPOTS_PER_IMAGE = 20;

  /** Validate and normalise a hotspot list submitted for one image. */
  private normaliseHotspots(input: unknown): InteractiveHotspot[] | null {
    if (input === null) return null;
    if (!Array.isArray(input)) {
      throw new BadRequestException('hotspots must be an array');
    }
    if (input.length > ProductsService.MAX_HOTSPOTS_PER_IMAGE) {
      throw new BadRequestException(
        `An image can have at most ${ProductsService.MAX_HOTSPOTS_PER_IMAGE} hotspots.`,
      );
    }
    return input.map((raw: any) => {
      const x = Number(raw?.x);
      const y = Number(raw?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new BadRequestException('Each hotspot needs numeric x and y coordinates');
      }
      const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
      if (!label) throw new BadRequestException('Each hotspot needs a label');
      return {
        id: typeof raw?.id === 'string' && raw.id ? raw.id : `pinpoint-${Math.random().toString(36).slice(2, 10)}`,
        // Clamped rather than rejected: a marker dragged near the edge should still
        // land on the image instead of failing the whole save.
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
        label,
        tooltip: typeof raw?.tooltip === 'string' ? raw.tooltip.trim() : null,
        detail: typeof raw?.detail === 'string' ? raw.detail.trim() : null,
      };
    });
  }

  /**
   * Only URLs this application produced are accepted as gallery images.
   *
   * Accepting an arbitrary URL would let an admin (or anything that gets hold of the
   * admin session) point the storefront at a third-party host and track every visitor,
   * or at an internal address and turn the product page into an SSRF/probe primitive.
   * Uploads come back from UploadService as either a storage key or an absolute URL on
   * our own S3_PUBLIC_URL, so both shapes are accepted and nothing else is.
   */
  private assertOwnImageUrl(url: string, publicBase?: string | null): string {
    const value = String(url ?? '').trim();
    if (!value) throw new BadRequestException('Image url is required');
    const base = String(publicBase ?? '').replace(/\/+$/, '');
    const isOwn = value.startsWith('/uploads/')
      || value.startsWith('tenants/')
      || value.startsWith('uploads/')
      || (base.length > 0 && value.startsWith(`${base}/`));
    if (!isOwn) {
      throw new BadRequestException(
        'Image must be an upload from this storefront (a /uploads/... path or a URL on the configured storage host).',
      );
    }
    if (value.length > 500) throw new BadRequestException('Image url is too long');
    return value;
  }

  async listImages(productId: string) {
    return this.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
  }

  /**
   * Seed the gallery from the pre-gallery shape: `thumbnailUrl` plus any legacy
   * `mediaUrls`. Idempotent, and safe to call on every read of a product that has no
   * gallery rows yet — which is what makes the backfill safe for the row an older
   * deploy created after the migration but before the gallery code shipped.
   */
  async ensureImagesFromLegacy(product: {
    id: string;
    tenantId: string;
    title?: string | null;
    thumbnailUrl?: string | null;
    mediaUrls?: string[] | null;
    pinpoints?: unknown;
  }) {
    const existing = await this.listImages(product.id);
    if (existing.length > 0) return existing;

    const legacy: string[] = [];
    const primary = (product.thumbnailUrl ?? '').trim();
    if (primary) legacy.push(primary);
    for (const url of (product.mediaUrls ?? []) as string[]) {
      const value = String(url ?? '').trim();
      if (value && !legacy.includes(value)) legacy.push(value);
    }
    if (legacy.length === 0) return [];

    const legacyHotspots = Array.isArray((product as { pinpoints?: unknown }).pinpoints)
      ? ((product as { pinpoints?: unknown }).pinpoints as unknown[])
          .filter((h) => h && typeof h === 'object' && typeof (h as any).x === 'number' && typeof (h as any).y === 'number')
          .slice(0, ProductsService.MAX_HOTSPOTS_PER_IMAGE)
          .map((h: any) => ({
            id: typeof h.id === 'string' && h.id ? h.id : `pinpoint-${Math.random().toString(36).slice(2, 10)}`,
            x: Math.min(100, Math.max(0, Number(h.x))),
            y: Math.min(100, Math.max(0, Number(h.y))),
            label: typeof h.label === 'string' && h.label ? h.label : 'Point',
            tooltip: h.tooltip ?? null,
            detail: h.detail ?? null,
          }))
      : [];

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(productImages)
        .values(
          legacy.slice(0, ProductsService.MAX_IMAGES).map((url, index) => ({
            tenantId: product.tenantId,
            productId: product.id,
            url,
            alt: index === 0 ? (product.title ?? null) : null,
            // Pre-gallery products kept one product-level hotspot list that could only
            // have described the thumbnail, so it moves onto the primary image rather
            // than being dropped.
            hotspots: index === 0 && legacyHotspots.length > 0 ? legacyHotspots : null,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        )
        .returning();
      return inserted.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  private async assertProductInTenant(tenantId: string, productId: string) {
    const row = await this.db
      .select({ id: productsBundle.id })
      .from(productsBundle)
      .where(and(eq(productsBundle.id, productId), eq(productsBundle.tenantId, tenantId)))
      .limit(1);
    if (!row[0]) {
      // Deliberately NotFound rather than Forbidden: a caller must not be able to
      // probe for the existence of another tenant's product id.
      throw new NotFoundException('Product not found');
    }
  }

  /** Append an image. Position, primary flag and thumbnail stay consistent in one tx. */
  async addImage(params: {
    tenantId: string;
    productId: string;
    url: string;
    alt?: string | null;
    hotspots?: unknown;
    publicBase?: string | null;
    makePrimary?: boolean;
  }) {
    await this.assertProductInTenant(params.tenantId, params.productId);
    const url = this.assertOwnImageUrl(params.url, params.publicBase);
    const hotspots = params.hotspots === undefined ? [] : this.normaliseHotspots(params.hotspots);
    const current = await this.listImages(params.productId);
    if (current.length >= ProductsService.MAX_IMAGES) {
      throw new BadRequestException(`A product can have at most ${ProductsService.MAX_IMAGES} images.`);
    }

    return this.db.transaction(async (tx) => {
      const nextOrder = current.length === 0 ? 0 : Math.max(...current.map((i) => i.sortOrder)) + 1;
      const makePrimary = params.makePrimary === true || current.length === 0;
      const insertedRow = await tx
        .insert(productImages)
        .values({
          tenantId: params.tenantId,
          productId: params.productId,
          url,
          alt: params.alt ?? null,
          hotspots: hotspots && hotspots.length > 0 ? hotspots : null,
          sortOrder: nextOrder,
          isPrimary: makePrimary,
        })
        .returning();
      const inserted = insertedRow[0];
      if (!inserted) throw new BadRequestException('Could not store the image');
      if (makePrimary) {
        // Demote first: the partial unique index rejects two primaries at once.
        await tx.update(productImages).set({ isPrimary: false }).where(and(eq(productImages.productId, params.productId), sql`${productImages.id} <> ${inserted.id}`));
        // Single write path for the denormalised primary: gallery row + thumbnail.
        await tx.update(productsBundle).set({ thumbnailUrl: url, updatedAt: new Date() }).where(eq(productsBundle.id, params.productId));
      }
      return inserted;
    });
  }

  /**
   * Rename one image, or promote it to primary.
   *
   * Setting the primary writes the gallery flag and `products.thumbnail_url` in the
   * same transaction, so the two can never disagree.
   */
  async updateImage(params: {
    tenantId: string;
    productId: string;
    imageId: string;
    alt?: string | null;
    hotspots?: unknown;
    setPrimary?: boolean;
  }) {
    await this.assertProductInTenant(params.tenantId, params.productId);
    const current = await this.listImages(params.productId);
    const target = current.find((i) => i.id === params.imageId);
    if (!target) throw new NotFoundException('Image not found');

    return this.db.transaction(async (tx) => {
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (params.alt !== undefined) values.alt = params.alt;
      // Omitted hotspots leave the image untouched; `hotspots: []` clears them.
      if (params.hotspots !== undefined) {
        const hotspots = this.normaliseHotspots(params.hotspots);
        values.hotspots = hotspots && hotspots.length > 0 ? hotspots : null;
      }
      if (params.setPrimary === true) values.isPrimary = true;
      let updated;
      if (params.setPrimary === true) {
        /**
         * Demote everyone BEFORE promoting. `product_images_one_primary_idx` is a
         * partial unique index, so setting the new primary while the old one is still
         * primary is an immediate constraint violation — the order of these two
         * statements is load-bearing, not stylistic.
         */
        await tx.update(productImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(productImages.productId, params.productId), sql`${productImages.id} <> ${params.imageId}`));
        const promoted = await tx
          .update(productImages)
          .set({ ...values, isPrimary: true, updatedAt: new Date() })
          .where(and(eq(productImages.id, params.imageId), eq(productImages.tenantId, params.tenantId)))
          .returning();
        updated = promoted[0];
        if (!updated) throw new NotFoundException('Image not found');
        await tx.update(productsBundle)
          .set({ thumbnailUrl: updated.url, updatedAt: new Date() })
          .where(eq(productsBundle.id, params.productId));
      } else {
        const updatedRow = await tx
          .update(productImages)
          .set(values)
          .where(and(eq(productImages.id, params.imageId), eq(productImages.tenantId, params.tenantId)))
          .returning();
        updated = updatedRow[0];
        if (!updated) throw new NotFoundException('Image not found');
      }
      return updated;
    });
  }

  /**
   * Reorder by explicit id list. The whole set is renumbered from 0 in one
   * transaction, which keeps `sort_order` gapless without a unique index fighting
   * intermediate states. Ids not belonging to this product are rejected rather than
   * silently ignored.
   */
  async reorderImages(params: { tenantId: string; productId: string; imageIds: string[] }) {
    await this.assertProductInTenant(params.tenantId, params.productId);
    const current = await this.listImages(params.productId);
    const known = new Set(current.map((i) => i.id));
    const requested = Array.isArray(params.imageIds) ? params.imageIds : [];
    /**
     * "Exactly once" means exactly once. A length check alone lets a duplicated id
     * through, which would then assign two rows the same sort_order — and since
     * sort_order is deliberately not uniquely constrained (see the schema comment),
     * nothing downstream would notice. Duplicates are rejected here.
     */
    const unique = new Set(requested);
    if (
      requested.length !== current.length
      || unique.size !== requested.length
      || requested.some((id) => !known.has(id))
    ) {
      throw new BadRequestException('Reorder must list every image of this product exactly once.');
    }

    return this.db.transaction(async (tx) => {
      const updated: typeof current = [];
      for (let index = 0; index < requested.length; index += 1) {
        const imageId = requested[index];
        if (!imageId) continue;
        const row = await tx
          .update(productImages)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(eq(productImages.id, imageId), eq(productImages.tenantId, params.tenantId)))
          .returning();
        if (row[0]) updated.push(row[0]);
      }
      return updated.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  /**
   * Delete one image. If it was primary, another image is promoted in the same
   * transaction so the product is never left without a thumbnail.
   *
   * Storage deletion is best-effort and deliberately NOT awaited: the object is only
   * removed if it lives on our own bucket, and a storage outage must not roll back a
   * database change the admin already saw succeed.
   */
  async deleteImage(params: { tenantId: string; productId: string; imageId: string }) {
    await this.assertProductInTenant(params.tenantId, params.productId);
    const current = await this.listImages(params.productId);
    const target = current.find((i) => i.id === params.imageId);
    if (!target) throw new NotFoundException('Image not found');
    const remaining = current.filter((i) => i.id !== params.imageId);

    const result = await this.db.transaction(async (tx) => {
      await tx.delete(productImages)
        .where(and(eq(productImages.id, params.imageId), eq(productImages.tenantId, params.tenantId)));

      let nextPrimary = remaining.find((i) => i.isPrimary) ?? null;
      if (target.isPrimary || !nextPrimary) nextPrimary = remaining[0] ?? null;

      if (nextPrimary) {
        // Always promote unconditionally: the replacement was usually a non-primary
        // row, and copying its existing flag left the product with NO primary at all.
        await tx.update(productImages)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(productImages.productId, params.productId), sql`${productImages.id} <> ${nextPrimary.id}`));
        await tx.update(productImages)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(productImages.id, nextPrimary.id));
        await tx.update(productsBundle)
          .set({ thumbnailUrl: nextPrimary.url, updatedAt: new Date() })
          .where(eq(productsBundle.id, params.productId));
      } else {
        // Last image removed: the product keeps a consistent, empty primary.
        await tx.update(productsBundle)
          .set({ thumbnailUrl: null, updatedAt: new Date() })
          .where(eq(productsBundle.id, params.productId));
      }

      // Gapless renumber so a later reorder starts from a clean sequence.
      for (let index = 0; index < remaining.length; index += 1) {
        const row = remaining[index];
        if (row && row.sortOrder !== index) {
          await tx.update(productImages).set({ sortOrder: index }).where(eq(productImages.id, row.id));
        }
      }
      return { deleted: true, id: params.imageId, nextPrimaryUrl: nextPrimary?.url ?? null, remaining: remaining.length };
    });

    void this.deleteStoredObject(target.url);
    return result;
  }

  /**
   * Best-effort removal of an uploaded object. Failures are logged, never thrown.
   *
   * Production stores objects in S3/Supabase Storage, where UploadService.deleteFile is
   * a no-op (it only unlinks local disk), so the S3 key is derived from the URL and
   * removed through StorageService. A leftover object costs storage; failing the
   * admin's delete over it would be worse than an orphan.
   */
  private async deleteStoredObject(url: string) {
    try {
      const publicBase = String(this.config?.get('S3_PUBLIC_URL') ?? '').replace(/\/+$/, '');
      const key = publicBase && url.startsWith(`${publicBase}/`)
        ? url.slice(publicBase.length + 1)
        : url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
      // Only ever delete inside our own uploads prefix.
      if (!/^(uploads|tenants)\//.test(key)) {
        console.warn('[products] refusing to delete a path outside the uploads prefix', key);
        return;
      }
      if (this.storage) {
        await this.storage.deleteObject(key);
        return;
      }
      console.warn('[products] storage service unavailable; leaving object', key);
    } catch (error) {
      console.warn('[products] could not remove stored object', url, (error as Error)?.message ?? error);
    }
  }

  async publish(id: string) {
    const product = await this.findById(id);
    const reasons: string[] = [];
    if (!product.title) reasons.push('Title is required');
    if (!product.slug) reasons.push('Slug is required');
    if (product.price != null && product.price <= 0) reasons.push('Price must be greater than 0');
    if (!product.thumbnailUrl) reasons.push('Thumbnail image is required');
    if (reasons.length > 0) {
      throw new BadRequestException({ message: 'Product is not ready to publish', reasons });
    }
    return this.applyLifecycle(id, { isPublished: true, status: 'published' });
  }

  async unpublish(id: string) {
    return this.applyLifecycle(id, { isPublished: false, status: 'draft' });
  }

  async archive(id: string) {
    return this.applyLifecycle(id, { isArchived: true, status: 'archived', isPublished: false });
  }

  async restore(id: string) {
    return this.applyLifecycle(id, { isArchived: false, status: 'draft' });
  }

  async remove(id: string) {
    const product = await this.findById(id);
    await this.db.delete(productsBundle).where(eq(productsBundle.id, id));
    void this.search?.removeEntity(product.tenantId, 'product', product.id);
    return { deleted: true, id };
  }
}
