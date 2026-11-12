import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { ensureNodeIds, localizeDefaultLayout, seedHomeLayout, type PageLayout } from '@titan/shared';
import { DrizzleService } from '../../database/drizzle.service';
import { pages, pageVersions } from '../../database/schema/pages';
import { tenants } from '../../database/schema/tenants';

/** Bumped when the built-in homepage is redesigned and existing homepages should adopt it. */
export const HOME_LAYOUT_REVISION = 'home-2026-11';

/**
 * Moves each tenant's homepage onto the redesigned layout, once.
 *
 * The homepage is a builder page, so a new default layout alone changes nothing for a tenant
 * that already has a homepage row: the builder keeps editing the old draft while the public
 * site shows whichever is published, and the two disagree. On the first boot after the redesign
 * ships, the current homepage is kept as a version (restorable from the builder's version
 * history) and the redesign is published in its place with its Arabic copy, so the builder and
 * the live site start out identical. A marker in the tenant settings makes this run once.
 */
@Injectable()
export class HomeRedesignUpgradeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HomeRedesignUpgradeService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_HOME_REDESIGN_UPGRADE === 'true') return;
    void this.run().catch((error: unknown) => {
      this.logger.warn(`Homepage upgrade skipped: ${error instanceof Error ? error.message : error}`);
    });
  }

  async run(): Promise<number> {
    const rows = await this.drizzle.db.select().from(tenants);
    let upgraded = 0;
    for (const tenant of rows) {
      const settings = (tenant.settings ?? {}) as Record<string, unknown>;
      const seeds = (settings.builderSeeds ?? {}) as Record<string, unknown>;
      if (seeds.home === HOME_LAYOUT_REVISION) continue;
      if (await this.upgradeTenant(tenant.id)) upgraded += 1;
      await this.drizzle.db
        .update(tenants)
        .set({ settings: { ...settings, builderSeeds: { ...seeds, home: HOME_LAYOUT_REVISION } } })
        .where(eq(tenants.id, tenant.id));
    }
    if (upgraded) this.logger.log(`Published the redesigned homepage for ${upgraded} tenant(s)`);
    return upgraded;
  }

  private async upgradeTenant(tenantId: string): Promise<boolean> {
    return this.drizzle.db.transaction(async (tx) => {
      const [page] = await tx
        .select()
        .from(pages)
        .where(and(eq(pages.tenantId, tenantId), eq(pages.slug, 'home')))
        .for('update');
      // No row: the public site already renders the built-in layout, which is the redesign.
      if (!page) return false;

      const [history] = await tx
        .select({ maxVersion: sql<number | null>`max(${pageVersions.version})` })
        .from(pageVersions)
        .where(eq(pageVersions.pageId, page.id));
      const base = Math.max(page.version ?? 0, Number(history?.maxVersion ?? 0));

      await tx.insert(pageVersions).values({
        pageId: page.id,
        tenantId,
        version: base + 1,
        layout: page.layout as PageLayout,
        status: 'snapshot',
        note: 'Homepage before the redesign (restore it from here)',
      });

      const layout = ensureNodeIds(seedHomeLayout());
      await tx.insert(pageVersions).values({
        pageId: page.id,
        tenantId,
        version: base + 2,
        layout,
        status: 'published',
        note: 'Redesigned homepage',
      });

      const translations = (page.translations ?? {}) as Record<string, Record<string, unknown>>;
      await tx
        .update(pages)
        .set({
          layout,
          status: 'published',
          version: base + 2,
          publishedAt: new Date(),
          updatedAt: new Date(),
          translations: {
            ...translations,
            ar: { ...(translations.ar ?? {}), layout: localizeDefaultLayout(layout) },
          } as never,
        })
        .where(eq(pages.id, page.id));
      return true;
    });
  }
}
