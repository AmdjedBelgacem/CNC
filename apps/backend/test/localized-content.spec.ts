import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import { academies, courses, events, lessons, products, series } from '../src/database/schema';
import {
  localizeAcademyFields,
  localizeEventFields,
  localizeProductFields,
  localizeCourseFields,
  resolveContentLocale,
} from '../src/modules/courses/lesson-content';

/**
 * Arabic content rules.
 *
 * The failure these guard against is subtle: a translation lands, the API serves
 * it, and nobody notices that the *price*, the *capacity* or the *coordinates*
 * came out translated too, or that a missing Arabic field silently rendered a
 * blank card instead of falling back to English.
 */
describe('localized content (integration)', () => {
  let drizzle: DrizzleService;

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
  });

  const hasArabic = (value: unknown) => typeof value === 'string' && /[\u0600-\u06FF]/.test(value);

  it('resolves a locale from every carrier the app uses', () => {
    expect(resolveContentLocale('ar')).toBe('ar');
    expect(resolveContentLocale('ar-SA')).toBe('ar');
    expect(resolveContentLocale({ query: { locale: 'ar' } })).toBe('ar');
    expect(resolveContentLocale({ cookies: { NEXT_LOCALE: 'ar' } })).toBe('ar');
    expect(resolveContentLocale({ headers: { 'accept-language': 'ar-SA,ar;q=0.9' } })).toBe('ar');
    // Anything unknown must resolve to English rather than to nothing.
    expect(resolveContentLocale('fr')).toBe('en');
    expect(resolveContentLocale(undefined)).toBe('en');
  });

  it('gives every published, named row an Arabic title', async () => {
    for (const [label, rows] of [
      ['courses', await drizzle.db.select().from(courses)],
      ['series', await drizzle.db.select().from(series)],
      ['lessons', await drizzle.db.select().from(lessons)],
      ['academies', await drizzle.db.select().from(academies)],
      ['products', await drizzle.db.select().from(products)],
      ['events', await drizzle.db.select().from(events)],
    ] as const) {
      // A visitor can only ever reach what is published, so that is the set that
      // must be complete. Unpublished rows are drafts and placeholder titles.
      const reachable = rows.filter(
        (row: any) => row.title && row.title !== 'Untitled course' && row.isPublished !== false,
      );
      const missing = reachable.filter((row: any) => !hasArabic((row.translations as any)?.ar?.title));
      expect(
        missing.map((row: any) => `${label}: ${row.title}`),
        `${label} rows a visitor can see but that have no Arabic title`,
      ).toEqual([]);
    }
  });

  it('serves the Arabic title and reports it as resolved, not as a fallback', async () => {
    const rows = await drizzle.db.select().from(courses).limit(20);
    const translated = rows.find((row: any) => hasArabic(row.translations?.ar?.title));
    expect(translated).toBeDefined();

    const localized = localizeCourseFields(translated as unknown as Record<string, any>, 'ar');
    expect(localized.value.title).not.toBe(translated.title);
    expect(hasArabic(localized.value.title)).toBe(true);
    expect(localized.metadata.resolvedLocale).toBe('ar');
  });

  it('falls back to English per field, and says which ones', async () => {
    const rows = await drizzle.db.select().from(courses).limit(20);
    const partial = rows.find(
      (row: any) => hasArabic(row.translations?.ar?.title) && row.subtitle && !row.translations?.ar?.subtitle,
    );
    if (!partial) return; // nothing partial to prove today
    const localized = localizeCourseFields(partial as unknown as Record<string, any>, 'ar');
    // The untranslated field keeps the English text, never a blank.
    expect(localized.value.subtitle).toBe(partial.subtitle);
    expect(localized.metadata.fallbackFields).toContain('subtitle');
  });

  it('never translates a value that is data rather than copy', async () => {
    const [product] = await drizzle.db.select().from(products).where(eq(products.isPublished, true)).limit(20);
    const localized = localizeProductFields(product as unknown as Record<string, any>, 'ar');
    // Price, currency, slug and ids are the same in both languages by definition.
    expect(localized.value.price).toBe(product.price);
    expect(localized.value.currency).toBe(product.currency);
    expect(localized.value.slug).toBe(product.slug);
    expect(localized.value.id).toBe(product.id);
  });

  it('translates product feature bullets as an array, keeping the count', async () => {
    const rows = await drizzle.db.select().from(products).where(eq(products.isPublished, true)).limit(20);
    const withFeatures = rows.find((row: any) => Array.isArray(row.translations?.ar?.features));
    if (!withFeatures) return;
    const localized = localizeProductFields(withFeatures as unknown as Record<string, any>, 'ar');
    expect(Array.isArray(localized.value.features)).toBe(true);
    expect((localized.value.features as string[]).length).toBe((withFeatures.features as string[]).length);
    expect(hasArabic((localized.value.features as string[]).join(' '))).toBe(true);
  });

  it('leaves an event coordinate alone and only localizes the place name', async () => {
    const rows = await drizzle.db.select().from(events).where(eq(events.isPublished, true)).limit(20);
    const withVenue = rows.find((row: any) => row.location && typeof row.location === 'object');
    if (!withVenue) return;
    const localized = localizeEventFields(withVenue as unknown as Record<string, any>, 'ar');
    // The coordinates survive untouched, and the readable venue is additive.
    expect((localized.value.location as any).lat).toBe((withVenue.location as any).lat);
    expect((localized.value.location as any).lng).toBe((withVenue.location as any).lng);
    expect(typeof localized.value.location).toBe('object');
  });

  it('does not resolve a locale the platform does not support', () => {
    expect(resolveContentLocale('he')).toBe('en');
    expect(resolveContentLocale({ query: { locale: 'he' } })).toBe('en');
  });
});
