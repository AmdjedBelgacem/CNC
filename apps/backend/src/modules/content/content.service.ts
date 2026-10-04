import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { resolveContentLocale } from '../courses/lesson-content';
import { pages, pageVersions } from '../../database/schema/pages';
import { themes, themeVersions } from '../../database/schema/themes';
import { tenants } from '../../database/schema/tenants';
import { migrateLegacyLayout, type PageLayout, type TenantAnalyticsSettings } from '@titan/shared';

function normalizeAnalyticsId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

@Injectable()
export class ContentService {
  constructor(private drizzle: DrizzleService) {}

  /** Public read: always serves the immutable snapshot at the publication pointer. */
  /**
   * The published page a visitor actually receives, in their language.
   *
   * A locale with its own layout gets it. One without gets the English snapshot
   * with `resolvedLocale: 'en'`, so the client can tell "not translated yet" from
   * "translated" and never renders a half-empty page.
   */
  /**
   * Every publicly reachable page for the tenant: published, enabled, and with
   * a snapshot behind it. Backs the sitemap, the nav page picker and the
   * dynamic route's slug check.
   *
   * `is_system` pages are included; `home` is what a tenant's root renders.
   */
  async listPublishedPages(tenantId: string) {
    const rows = await this.drizzle.db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        seoTitle: pages.seoTitle,
        seoDescription: pages.seoDescription,
        version: pages.version,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .where(and(eq(pages.tenantId, tenantId), eq(pages.status, 'published')));
    return rows
      .filter((r) => r.version >= 1)
      .map((r) => ({
        slug: r.slug,
        title: r.seoTitle || r.title,
        description: r.seoDescription ?? null,
        updatedAt: r.updatedAt,
      }));
  }

  async getPublishedPage(tenantId: string, slug: string, localeInput?: unknown) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    // `status` is the gate, not `version`. A disabled page keeps its published
    // snapshot, so a version check alone would keep serving it after an admin
    // switched it off — the page would be "disabled" in the admin and live on
    // the public site. `draft` is covered here too: an admin editing a page that
    // has never been published must not be able to read it publicly.
    if (!page || page.status !== 'published' || page.version < 1) {
      throw new NotFoundException(`No published page found for "${slug}"`);
    }

    const snapshot = await this.drizzle.db.query.pageVersions.findFirst({
      where: and(
        eq(pageVersions.pageId, page.id),
        eq(pageVersions.version, page.version),
        eq(pageVersions.status, 'published'),
      ),
    });
    if (!snapshot) throw new NotFoundException(`Published version for "${slug}" was not found`);

    const locale = resolveContentLocale(localeInput);
    const englishLayout = migrateLegacyLayout(snapshot.layout as PageLayout);
    const copy = locale === 'en' ? undefined : (page.translations as Record<string, { title?: string; layout?: PageLayout }> | null)?.[locale];
    const base = {
      id: page.id,
      tenantId: page.tenantId,
      slug: page.slug,
      status: 'published' as const,
      version: snapshot.version,
      publishedAt: page.publishedAt,
    };
    if (copy?.layout) {
      return { ...base, title: copy.title ?? page.title, layout: copy.layout, locale, resolvedLocale: locale };
    }
    return {
      ...base,
      published: true,
      title: page.title,
      // Draft edits live on `pages.layout`; customers only receive this snapshot.
      layout: englishLayout,
      locale,
      resolvedLocale: 'en' as const,
    };
  }

  /**
   * The tenant's published theme.
   *
   * "Nothing published yet" is an ordinary state for a fresh tenant, not a
   * missing resource: the client falls back to `DEFAULT_THEME_TOKENS` and the
   * site renders correctly. Returning 404 for it put a red error in the console
   * on every page load, which trained everyone to ignore the console — the exact
   * thing that hid a real `INVALID_MESSAGE` crash later. An empty theme is a
   * 200 with `tokens: null`.
   */
  async getPublishedTheme(tenantId: string) {
    const theme = await this.drizzle.db.query.themes.findFirst({
      where: eq(themes.tenantId, tenantId),
    });
    if (!theme || theme.version < 1) {
      return { tokens: null, published: false };
    }

    const snapshot = await this.drizzle.db.query.themeVersions.findFirst({
      where: and(
        eq(themeVersions.themeId, theme.id),
        eq(themeVersions.version, theme.version),
        eq(themeVersions.status, 'published'),
      ),
    });
    if (!snapshot) return { tokens: null, published: false };

    return {
      id: theme.id,
      tenantId: theme.tenantId,
      name: theme.name,
      tokens: snapshot.tokens,
      status: 'published' as const,
      version: snapshot.version,
      publishedAt: theme.publishedAt,
    };
  }

  /**
   * Public read: analytics IDs for the tenant (allowlisted fields only).
   * Returns nulls when the tenant has no analytics config — the frontend then
   * falls back to env vars, then disables tags.
   */
  async getPublicAnalytics(tenantId: string): Promise<{
    gaMeasurementId: string | null;
    snapchatPixelId: string | null;
  }> {
    const tenant = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { settings: true },
    });
    const analytics = (tenant?.settings as { analytics?: TenantAnalyticsSettings } | null)
      ?.analytics;
    return {
      gaMeasurementId: normalizeAnalyticsId(analytics?.gaMeasurementId),
      snapchatPixelId: normalizeAnalyticsId(analytics?.snapchatPixelId),
    };
  }
}
