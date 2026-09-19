import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { pages } from '../../database/schema/pages';
import { themes } from '../../database/schema/themes';
import { migrateLegacyLayout, type PageLayout } from '@titan/shared';

@Injectable()
export class ContentService {
  constructor(private drizzle: DrizzleService) {}

  /** Public read: returns a page only when it has been published. */
  async getPublishedPage(tenantId: string, slug: string) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug), eq(pages.status, 'published')),
    });
    if (!page) throw new NotFoundException(`No published page found for "${slug}"`);
    return {
      id: page.id,
      tenantId: page.tenantId,
      slug: page.slug,
      title: page.title,
      // Serve the canonical slot shape; legacy rows migrate on read.
      layout: migrateLegacyLayout(page.layout as PageLayout),
      status: page.status,
      version: page.version,
      publishedAt: page.publishedAt,
    };
  }

  /** Public read: returns the published theme tokens for the tenant. */
  async getPublishedTheme(tenantId: string) {
    const theme = await this.drizzle.db.query.themes.findFirst({
      where: and(eq(themes.tenantId, tenantId), eq(themes.status, 'published')),
    });
    if (!theme) throw new NotFoundException('No published theme found for this tenant');
    return {
      id: theme.id,
      tenantId: theme.tenantId,
      name: theme.name,
      tokens: theme.tokens,
      status: theme.status,
      version: theme.version,
      publishedAt: theme.publishedAt,
    };
  }
}
