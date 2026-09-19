import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { productsBundle, productVariants } from '../../database/schema/products';
import { eq, and, asc, desc, like, count, inArray } from 'drizzle-orm';

@Injectable()
export class ProductsService {
  constructor(private drizzle: DrizzleService) {}

  private get q() { return this.drizzle.db.query; }
  private get db() { return this.drizzle.db; }

  async findByTenant(
    tenantId: string,
    opts?: {
      category?: string; featured?: boolean; search?: string;
      page?: number; limit?: number;
    },
  ) {
    const conditions: any[] = [eq(productsBundle.tenantId, tenantId)];
    if (opts?.featured) conditions.push(eq(productsBundle.featured, true));
    if (opts?.category) conditions.push(eq(productsBundle.category, opts.category));
    if (opts?.search) conditions.push(like(productsBundle.title, `%${opts.search}%`));
    conditions.push(eq(productsBundle.isPublished, true));

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

    return { data, total: totalArr[0]?.count || 0, page, limit };
  }

  async findBySlug(tenantId: string, slug: string) {
    const product = await this.q.products.findFirst({
      where: and(eq(productsBundle.tenantId, tenantId), eq(productsBundle.slug, slug)),
      with: { variants: { orderBy: asc(productVariants.sortOrder) } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
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

  async create(data: any) {
    const [product] = await this.db.insert(productsBundle).values(data).returning();
    return product;
  }

  async update(id: string, data: any) {
    const [product] = await this.db
      .update(productsBundle).set({ ...data, updatedAt: new Date() })
      .where(eq(productsBundle.id, id)).returning();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
