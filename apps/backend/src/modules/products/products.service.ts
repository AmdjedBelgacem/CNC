import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { localizeProductFields, resolveContentLocale } from '../courses/lesson-content';
import { DrizzleService } from '../../database/drizzle.service';
import { productsBundle, productVariants } from '../../database/schema/products';
import { eq, and, asc, desc, like, count, inArray, sql } from 'drizzle-orm';
import { SearchService } from '../search/search.service';

@Injectable()
export class ProductsService {
  constructor(
    private drizzle: DrizzleService,
    private search?: SearchService,
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

  async create(data: any) {
    const [product] = await this.db.insert(productsBundle).values(data).returning();
    if (product) this.syncSearch(product.tenantId, product.id);
    return product;
  }

  async update(id: string, data: any) {
    const [product] = await this.db
      .update(productsBundle).set({ ...data, updatedAt: new Date() })
      .where(eq(productsBundle.id, id)).returning();
    if (!product) throw new NotFoundException('Product not found');
    this.syncSearch(product.tenantId, product.id);
    return product;
  }

  async publish(id: string) {
    const product = await this.findById(id);
    const reasons: string[] = [];
    if (!product.title) reasons.push('Title is required');
    if (!product.slug) reasons.push('Slug is required');
    if (!product.price || product.price <= 0) reasons.push('Price must be greater than 0');
    if (!product.thumbnailUrl) reasons.push('Thumbnail image is required');
    if (reasons.length > 0) {
      throw new BadRequestException({ message: 'Product is not ready to publish', reasons });
    }
    return this.update(id, { isPublished: true, status: 'published' });
  }

  async unpublish(id: string) {
    return this.update(id, { isPublished: false, status: 'draft' });
  }

  async archive(id: string) {
    return this.update(id, { isArchived: true, status: 'archived', isPublished: false });
  }

  async restore(id: string) {
    return this.update(id, { isArchived: false, status: 'draft' });
  }

  async remove(id: string) {
    const product = await this.findById(id);
    await this.db.delete(productsBundle).where(eq(productsBundle.id, id));
    void this.search?.removeEntity(product.tenantId, 'product', product.id);
    return { deleted: true, id };
  }
}
