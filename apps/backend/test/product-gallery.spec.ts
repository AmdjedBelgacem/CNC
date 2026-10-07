import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../src/database/drizzle.service';
import { products, productImages, tenants } from '../src/database/schema';
import { ProductsService } from '../src/modules/products/products.service';

/**
 * Two guarantees, tested against a real Postgres because both depend on SQL semantics
 * a hand-written mock cannot honestly reproduce (transactions, ordering, the partial
 * unique index on the primary).
 *
 *  1. PATCH is a genuine partial update. The production data loss came from the admin
 *     form posting every column on every save — including nulls for fields it had never
 *     loaded — and the service spreading that body straight into the UPDATE.
 *  2. The gallery stays consistent: gapless ordering, exactly one primary, and the
 *     denormalised thumbnail always mirroring that primary.
 */
describe('product gallery + partial save (integration)', () => {
  let drizzle: DrizzleService;
  let service: ProductsService;
  let tenantId: string;
  const created: string[] = [];

  const FULL = {
    title: 'End Mill Kit',
    slug: 'end-mill-kit',
    description: 'A long description that must survive a partial save',
    tagline: 'tagline',
    category: 'Tool Kits',
    price: 19900,
    currency: 'SAR',
    thumbnailUrl: '/uploads/covers/legacy.png',
    features: ['a', 'b'],
    pinpoints: [{ id: 'p', x: 1, y: 2, label: 'l' }],
    documents: [{ title: 'Manual', url: '/uploads/attachments/m.pdf' }],
  };

  let seq = 0;
  async function makeProduct(overrides: Record<string, unknown> = {}) {
    seq += 1;
    const slug = `end-mill-kit-${seq}`;
    const [row] = await drizzle.db
      .insert(products)
      // The slug must be unique per test: findBySlug returns the first match, and a
      // shared fixture slug would resolve to a sibling test's row.
      .values({ ...FULL, slug, ...overrides, tenantId, currency: 'SAR', trackInventory: true })
      .returning();
    created.push(row.id);
    return row;
  }

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    service = new ProductsService(drizzle as never);
    const [tenant] = await drizzle.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .limit(1);
    tenantId = tenant.id;
  });

  beforeEach(async () => {
    if (created.length === 0) return;
    await drizzle.db.delete(productImages).where(inArray(productImages.productId, [...created]));
  });

  afterAll(async () => {
    if (created.length === 0) return;
    await drizzle.db.delete(productImages).where(inArray(productImages.productId, [...created]));
    await drizzle.db.delete(products).where(inArray(products.id, [...created]));
  });

  // ------------------------------------------------------------------ PATCH ---

  it('changes only the keys present in the body', async () => {
    const product = await makeProduct();
    await service.update(product.id, { title: 'Renamed' });
    const after = await service.findById(product.id);
    expect(after.title).toBe('Renamed');
    expect(after.description).toBe(FULL.description);
    expect(after.price).toBe(19900);
    expect(after.thumbnailUrl).toBe(FULL.thumbnailUrl);
    expect(after.features).toEqual(['a', 'b']);
    expect(after.pinpoints).toHaveLength(1);
    expect(after.documents).toHaveLength(1);
  });

  it('never reads an omitted key as "clear" — the exact production data loss', async () => {
    const product = await makeProduct();
    // A form that only ever held the title.
    await service.update(product.id, { title: 'Only the title' });
    const after = await service.findById(product.id);
    expect(after.description).toBe(FULL.description);
    expect(after.price).toBe(19900);
    expect(after.thumbnailUrl).toBe(FULL.thumbnailUrl);
    expect(after.documents).toHaveLength(1);
    expect(after.pinpoints).toHaveLength(1);
  });

  it('treats an explicit null as a deliberate clear', async () => {
    const product = await makeProduct();
    await service.update(product.id, { description: null, price: null });
    const after = await service.findById(product.id);
    expect(after.description).toBeNull();
    expect(after.price).toBeNull();
    expect(after.title).toBe('End Mill Kit');
  });

  it('refuses to write columns that are not admin-editable', async () => {
    const product = await makeProduct();
    await service.update(product.id, {
      tenantId: '00000000-0000-0000-0000-000000000000',
      isPublished: true,
      status: 'published',
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Legit change',
    });
    const after = await service.findById(product.id);
    expect(after.tenantId).toBe(tenantId);
    expect(after.isPublished).toBe(false);
    expect(after.status).toBe('draft');
    expect(after.id).toBe(product.id);
    expect(after.title).toBe('Legit change');
  });

  it('is idempotent: the same save twice yields the same row', async () => {
    const product = await makeProduct();
    const body = { title: 'Same', price: 100, description: 'Same description' };
    await service.update(product.id, { ...body });
    const first = await service.findById(product.id);
    await service.update(product.id, { ...body });
    const second = await service.findById(product.id);
    expect({ ...second, updatedAt: undefined }).toEqual({ ...first, updatedAt: undefined });
    expect(second.title).toBe('Same');
  });

  it('leaves updatedAt alone when the body carries no editable field', async () => {
    const product = await makeProduct();
    const before = (await service.findById(product.id)).updatedAt.getTime();
    await service.update(product.id, { tenantId: 'x', id: 'y' });
    expect((await service.findById(product.id)).updatedAt.getTime()).toBe(before);
  });

  it('refuses to blank the product identity — the state that made it unreachable', async () => {
    const product = await makeProduct();
    // This is verbatim the payload the buggy admin form sent, and the reason the
    // product then 404'd on every save: slug became ''.
    await expect(
      service.update(product.id, {
        title: '', slug: '', description: null, price: null, thumbnailUrl: null,
        pinpoints: null, documents: null, features: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = await service.findById(product.id);
    expect(after.title).toBe('End Mill Kit');
    expect(after.slug).toBe(product.slug);
    expect(after.description).toBe(FULL.description);
    expect(after.thumbnailUrl).toBe(FULL.thumbnailUrl);
    // still reachable by the slug the storefront uses
    expect((await service.findBySlug(tenantId, product.slug)).id).toBe(product.id);
  });

  it('still allows whitespace-trimmed-but-present values', async () => {
    const product = await makeProduct();
    await service.update(product.id, { title: '  Renamed  ' });
    expect((await service.findById(product.id)).title).toBe('  Renamed  ');
  });

  it('answers 409 for a stale write and keeps the stored value', async () => {
    const product = await makeProduct();
    await expect(
      service.update(product.id, { title: 'Stale' }, '2020-01-01T00:00:00.000Z'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.findById(product.id)).title).toBe('End Mill Kit');
  });

  it('accepts the write when expectedUpdatedAt matches', async () => {
    const product = await makeProduct();
    const fresh = await service.findById(product.id);
    await service.update(product.id, { title: 'Fresh' }, fresh.updatedAt.toISOString());
    expect((await service.findById(product.id)).title).toBe('Fresh');
  });

  // ----------------------------------------------------------------- gallery ---

  it('backfills a gallery from the legacy thumbnail + mediaUrls shape', async () => {
    const product = await makeProduct({
      thumbnailUrl: '/uploads/covers/one.png',
      mediaUrls: ['/uploads/covers/two.png'],
    });
    const images = await service.ensureImagesFromLegacy(product as never);
    expect(images).toHaveLength(2);
    expect(images[0].isPrimary).toBe(true);
    expect(images[0].url).toBe('/uploads/covers/one.png');
    expect(images[1].sortOrder).toBe(1);
  });

  it('backfill is idempotent and never duplicates rows', async () => {
    const product = await makeProduct({ thumbnailUrl: '/uploads/covers/one.png', mediaUrls: null });
    await service.ensureImagesFromLegacy(product as never);
    await service.ensureImagesFromLegacy(product as never);
    expect(await service.listImages(product.id)).toHaveLength(1);
  });

  it('backfills nothing for a product that never had an image', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    expect(await service.ensureImagesFromLegacy(product as never)).toEqual([]);
  });

  it('appends images in order; the first becomes primary and the thumbnail follows', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    for (const n of [1, 2, 3]) {
      await service.addImage({ tenantId, productId: product.id, url: `/uploads/covers/${n}.png` });
    }
    const images = await service.listImages(product.id);
    expect(images.map((i) => i.url)).toEqual([
      '/uploads/covers/1.png', '/uploads/covers/2.png', '/uploads/covers/3.png',
    ]);
    expect(images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
    expect((await service.findById(product.id)).thumbnailUrl).toBe('/uploads/covers/1.png');
  });

  it('reorders by explicit id list and renumbers from zero', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    for (const n of [1, 2, 3]) {
      await service.addImage({ tenantId, productId: product.id, url: `/uploads/covers/${n}.png` });
    }
    const reversed = [...(await service.listImages(product.id))].reverse().map((i) => i.id);
    await service.reorderImages({ tenantId, productId: product.id, imageIds: reversed });
    const after = await service.listImages(product.id);
    expect(after.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(after[0].url).toBe('/uploads/covers/3.png');
  });

  it('rejects a reorder that omits or duplicates an image', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/1.png' });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/2.png' });
    const images = await service.listImages(product.id);
    await expect(
      service.reorderImages({ tenantId, productId: product.id, imageIds: [images[0].id] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reorderImages({ tenantId, productId: product.id, imageIds: [images[0].id, images[0].id] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setting a primary moves the flag and the thumbnail together', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/1.png' });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/2.png' });
    const second = (await service.listImages(product.id))[1];
    await service.updateImage({ tenantId, productId: product.id, imageId: second.id, setPrimary: true });
    const images = await service.listImages(product.id);
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(images.find((i) => i.isPrimary)?.id).toBe(second.id);
    expect((await service.findById(product.id)).thumbnailUrl).toBe(second.url);
  });

  it('updates alt text without disturbing primary or order', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/1.png' });
    const first = (await service.listImages(product.id))[0];
    await service.updateImage({ tenantId, productId: product.id, imageId: first.id, alt: 'Spindle close-up' });
    const after = await service.listImages(product.id);
    expect(after[0].alt).toBe('Spindle close-up');
    expect(after[0].isPrimary).toBe(true);
    expect(after[0].sortOrder).toBe(0);
  });

  it('deletes one image, promotes another, and leaves the rest of the product alone', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    for (const n of [1, 2, 3]) {
      await service.addImage({ tenantId, productId: product.id, url: `/uploads/covers/${n}.png` });
    }
    const primary = (await service.listImages(product.id)).find((i) => i.isPrimary)!;
    const result = await service.deleteImage({ tenantId, productId: product.id, imageId: primary.id });
    const images = await service.listImages(product.id);
    expect(images).toHaveLength(2);
    expect(result.deleted).toBe(true);
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(images.map((i) => i.sortOrder)).toEqual([0, 1]);
    const after = await service.findById(product.id);
    expect(after.title).toBe('End Mill Kit');
    expect(after.thumbnailUrl).toBe(images.find((i) => i.isPrimary)?.url);
  });

  it('removing the last image leaves a consistent empty primary', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/only.png' });
    const only = (await service.listImages(product.id))[0];
    await service.deleteImage({ tenantId, productId: product.id, imageId: only.id });
    expect(await service.listImages(product.id)).toHaveLength(0);
    const after = await service.findById(product.id);
    expect(after.thumbnailUrl).toBeNull();
    expect(after.title).toBe('End Mill Kit');
  });

  // ------------------------------------------- limits, validation, isolation ---

  it('enforces the 12-image cap', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    for (let n = 0; n < 12; n += 1) {
      await service.addImage({ tenantId, productId: product.id, url: `/uploads/covers/${n}.png` });
    }
    await expect(
      service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/13.png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.listImages(product.id)).toHaveLength(12);
  });

  it('refuses an image url this storefront did not produce', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    for (const bad of [
      'https://evil.example.com/tracker.png',
      'http://169.254.169.254/latest/meta-data/',
      '/etc/passwd',
      'javascript:alert(1)',
      '',
    ]) {
      await expect(
        service.addImage({ tenantId, productId: product.id, url: bad }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(await service.listImages(product.id)).toHaveLength(0);
  });

  it('accepts an absolute url on the configured storage host', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({
      tenantId,
      productId: product.id,
      url: 'https://cdn.example.com/storage/v1/object/public/uploads/covers/x.png',
      publicBase: 'https://cdn.example.com/storage/v1/object/public/uploads',
    });
    expect(await service.listImages(product.id)).toHaveLength(1);
  });

  it('cannot add, reorder, update or delete images on another tenant product', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/1.png' });
    const imageId = (await service.listImages(product.id))[0].id;
    const otherTenant = '00000000-0000-0000-0000-000000000000';
    for (const attempt of [
      service.addImage({ tenantId: otherTenant, productId: product.id, url: '/uploads/covers/x.png' }),
      service.deleteImage({ tenantId: otherTenant, productId: product.id, imageId }),
      service.reorderImages({ tenantId: otherTenant, productId: product.id, imageIds: [imageId] }),
      service.updateImage({ tenantId: otherTenant, productId: product.id, imageId, setPrimary: true }),
    ]) {
      // NotFound, not Forbidden: a caller must not be able to probe for existence.
      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(await service.listImages(product.id)).toHaveLength(1);
    expect((await service.listImages(product.id))[0].url).toBe('/uploads/covers/1.png');
  });

  it('a gallery is untouched by an ordinary product save', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [] });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/1.png' });
    await service.addImage({ tenantId, productId: product.id, url: '/uploads/covers/2.png' });
    const before = (await service.listImages(product.id)).map((i) => i.id);
    await service.update(product.id, { title: 'Title only', description: null });
    const after = await service.listImages(product.id);
    expect(after.map((i) => i.id)).toEqual(before);
    expect(after).toHaveLength(2);
  });

  it('publish requires a title, slug and thumbnail, and allows a null price', async () => {
    const product = await makeProduct({ thumbnailUrl: null, mediaUrls: [], price: null });
    // The reasons travel in the exception payload, not in the message string.
    await expect(service.publish(product.id)).rejects.toMatchObject({
      response: { message: 'Product is not ready to publish', reasons: expect.arrayContaining([expect.stringMatching(/Thumbnail/i)]) },
    });
    await service.update(product.id, { thumbnailUrl: '/uploads/covers/x.png' });
    const published = await service.publish(product.id);
    expect(published.isPublished).toBe(true);
    expect(published.price).toBeNull();
  });
});
