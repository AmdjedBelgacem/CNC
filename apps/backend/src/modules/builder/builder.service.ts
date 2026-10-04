import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc, asc } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { resolveContentLocale } from '../courses/lesson-content';
import type { ContentLocale } from '@titan/shared';
import { pages, pageVersions } from '../../database/schema/pages';
import { savedSections } from '../../database/schema/saved-sections';
import { themes, themeVersions } from '../../database/schema/themes';
import { AuditService } from '../auth/services/audit.service';
import {
  validatePageLayout,
  validateSlug,
  BUILDER_PAGE_SLUGS,
  getTemplateLayout,
  savedSectionSchema,
  themeTokensSchema,
  DEFAULT_THEME_TOKENS,
  DEFAULT_THEME_NAME,
  getDefaultLayout,
  BUILDER_PAGE_DEFS,
  migrateLegacyLayout,
  inlineSectionZones,
} from '@titan/shared';
import type { PageLayout, ThemeTokens, PuckNode } from '@titan/shared';
import { SearchService } from '../search/search.service';
import { NavigationService } from './navigation.service';

export interface Actor {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

interface AuditContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class BuilderService {
  constructor(
    private drizzle: DrizzleService,
    private audit: AuditService,
    private search?: SearchService,
    private navigation?: NavigationService,
  ) {}

  /** Renaming a page must not leave a menu pointing at the old URL. */
  private repointNavigation(tenantId: string, fromSlug: string, toSlug: string) {
    return this.navigation?.repoint(tenantId, fromSlug, toSlug) ?? Promise.resolve(0);
  }

  private removeNavigationFor(tenantId: string, slug: string) {
    return this.navigation?.removeForPage(tenantId, slug) ?? Promise.resolve(0);
  }

  private syncSearch(tenantId: string, pageId: string) {
    void this.search?.indexEntity(tenantId, 'page', pageId);
  }

  // ------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------

  private parsePageLayout(layout: unknown): PageLayout {
    const result = validatePageLayout(layout);
    if (!result.ok) {
      throw new BadRequestException(`Invalid layout: ${result.issues.join('; ')}`);
    }
    // Persist the canonical slot shape.
    return migrateLegacyLayout(result.data);
  }

  private parseThemeTokens(tokens: unknown): ThemeTokens {
    const parsed = themeTokensSchema.safeParse(tokens);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid theme tokens: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
      );
    }
    return parsed.data as unknown as ThemeTokens;
  }

  /** Resolves the request tenant, throwing if it is missing or inactive. */
  assertTenant(tenant: { id: string; isActive: boolean } | null | undefined): string {
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Tenant not found or inactive');
    }
    return tenant.id;
  }

  // ------------------------------------------------------------------
  // Pages
  // ------------------------------------------------------------------

  /**
   * Every page for the tenant, for the editor's page manager and the nav page
   * picker.
   *
   * The `layout` column is deliberately NOT selected. It was 61% of the response
   * (77KB of 124KB across 11 pages) and neither consumer reads it: the manager
   * draws a list, the picker reads slugs and titles. The editor fetches a single
   * page when it actually opens it.
   */
  async listPages(tenantId: string) {
    return this.drizzle.db
      .select({
        id: pages.id,
        tenantId: pages.tenantId,
        slug: pages.slug,
        title: pages.title,
        status: pages.status,
        version: pages.version,
        isSystem: pages.isSystem,
        showInNav: pages.showInNav,
        seoTitle: pages.seoTitle,
        seoDescription: pages.seoDescription,
        template: pages.template,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        publishedAt: pages.publishedAt,
        updatedById: pages.updatedById,
      })
      .from(pages)
      .where(eq(pages.tenantId, tenantId))
      .orderBy(asc(pages.createdAt));
  }

  /**
   * One page, in the requested language.
   *
   * A locale with its own layout gets it; a locale without one gets the English
   * layout with `resolvedLocale: 'en'`, so a page is never blank and a client can
   * tell the difference between "translated" and "not yet translated".
   */
  async getPage(tenantId: string, slug: string, localeInput?: unknown) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    // Serve the canonical slot shape: legacy DropZone-era rows (flat `zones`
    // map) are migrated on read until they are re-saved.
    if (page) return this.localizedPage(page, localeInput);
    // Only the seeded slugs auto-provision (see provisionPage). Anything else is
    // a page that does not exist, and the editor's create dialog is how you make
    // one — a GET that silently inserts a row hides typos until publish time.
    const created = await this.provisionPage(tenantId, slug);
    if (!created) throw new NotFoundException(`Page "${slug}" not found`);
    return { ...created, layout: created.layout };
  }

  /**
   * Overlay the requested language onto the page row.
   *
   * Generic so the rest of the row (`version`, timestamps, ids) survives: internal
   * callers use the page for versioning and the admin editor, and they must keep
   * seeing the English layout regardless of the request language.
   */
  private localizedPage<
    T extends { title: string; layout: unknown; translations?: Record<string, { title?: string; layout?: PageLayout }> | null },
  >(page: T, localeInput?: unknown): Omit<T, 'layout' | 'title'> & { title: string; layout: PageLayout; locale: ContentLocale; resolvedLocale: ContentLocale } {
    const locale = resolveContentLocale(localeInput);
    const englishLayout = migrateLegacyLayout(page.layout as PageLayout);
    const copy = locale === 'en' ? undefined : page.translations?.[locale];
    if (copy?.layout) {
      const { title: _ignoredTitle, layout: _ignoredLayout, ...rest } = page;
      return {
        ...rest,
        title: copy.title ?? page.title,
        layout: copy.layout,
        locale,
        resolvedLocale: locale,
      };
    }
    const { title: _t, layout: _l, ...rest } = page;
    return {
      ...rest,
      title: page.title,
      layout: englishLayout,
      locale,
      resolvedLocale: 'en',
    };
  }

  /**
   * Reserved and system slugs are rejected here rather than by the DB.
   *
   * A page at `/products` would pass every database constraint and publish
   * cleanly, then 404 for every visitor, because Next.js resolves the real
   * route directory before a dynamic `[slug]`. Failing at create time is the
   * only point where the author can still do something about it.
   */
  private assertSlugAvailable(slug: string) {
    const check = validateSlug(slug, { systemSlugs: BUILDER_PAGE_SLUGS });
    if (!check.ok) {
      const reason =
        check.reason === 'reserved'
          ? `"${check.slug}" is already used by a site route. Pick another name.`
          : check.reason === 'empty'
            ? 'A page needs a slug.'
            : check.reason === 'system'
              ? `"${check.slug}" is a built-in page and cannot be created.`
              : 'Use lowercase letters, numbers and single hyphens (e.g. "about-us").';
      throw new BadRequestException(reason);
    }
    return check.slug;
  }

  async createPage(
    tenantId: string,
    dto: {
      slug: string;
      title?: string;
      template?: string;
      showInNav?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
      copyFromSlug?: string;
    },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const slug = this.assertSlugAvailable(dto.slug);
    const existing = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    if (existing) throw new BadRequestException(`Page "${slug}" already exists`);

    // A new page gets a template layout, or a copy of another page's layout when
    // the author asked to start from existing content.
    let layout: PageLayout;
    if (dto.copyFromSlug) {
      const source = await this.drizzle.db.query.pages.findFirst({
        where: and(eq(pages.tenantId, tenantId), eq(pages.slug, dto.copyFromSlug)),
      });
      if (!source) throw new BadRequestException(`Source page "${dto.copyFromSlug}" was not found`);
      layout = migrateLegacyLayout(source.layout as PageLayout);
    } else {
      layout = getTemplateLayout(dto.template);
    }

    const [created] = await this.drizzle.db
      .insert(pages)
      .values({
        tenantId,
        slug,
        title: dto.title || this.defaultTitle(slug),
        layout,
        template: dto.template ?? null,
        showInNav: dto.showInNav ?? false,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        updatedById: actor.id,
      })
      .returning();

    if (created) this.syncSearch(tenantId, created.id);
    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.create',
      entityType: 'page',
      entityId: created?.id,
      tenantId,
      details: { slug, title: created?.title, template: dto.template ?? 'blank' },
      ...ctx,
    });
    return created;
  }

  /**
   * Partial update: title, slug, status, nav visibility, SEO.
   *
   * Status and slug are handled here rather than by a blanket patch because both
   * have rules a field assignment cannot express — a rename has to stay clear of
   * reserved slugs, and `published` is meaningless without a snapshot behind it.
   */
  async updatePage(
    tenantId: string,
    slug: string,
    dto: {
      title?: string;
      slug?: string;
      status?: 'draft' | 'published' | 'disabled';
      showInNav?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
    },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);

    const patch: Partial<typeof pages.$inferInsert> = { updatedById: actor.id };

    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.showInNav !== undefined) patch.showInNav = dto.showInNav;
    if (dto.seoTitle !== undefined) patch.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) patch.seoDescription = dto.seoDescription;

    if (dto.slug !== undefined && dto.slug !== slug) {
      const next = this.assertSlugAvailable(dto.slug);
      if (page.isSystem) {
        throw new BadRequestException(
          `"${slug}" is a built-in page. Its URL is part of the site, so it cannot be renamed.`,
        );
      }
      patch.slug = next;
    }

    if (dto.status !== undefined && dto.status !== page.status) {
      // Disabling keeps everything; re-enabling restores whatever status the
      // page had before, so a disabled draft does not silently become public.
      if (dto.status === 'published' && page.version < 1) {
        throw new BadRequestException(
          'This page has never been published. Publish it from the editor first.',
        );
      }
      if (page.isSystem && dto.status === 'draft') {
        throw new BadRequestException(`"${slug}" is live — disable it instead of putting it back in draft.`);
      }
      patch.status = dto.status;
    }

    const [updated] = await this.drizzle.db
      .update(pages)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pages.id, page.id))
      .returning();

    if (patch.slug && patch.slug !== slug) {
      // Keep navigation pointing at the page the author just moved it to.
      await this.repointNavigation(tenantId, slug, patch.slug);
    }

    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.update',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, patch: Object.keys(patch).filter((k) => k !== 'updatedById') },
      ...ctx,
    });
    return updated;
  }

  /**
   * Delete a page and everything hanging off it.
   *
   * Refuses system pages: `home` is the tenant's front door, and deleting it
   * would take the site down with no way back other than a restore. Navigation
   * entries pointing at the page are removed too, so no dead link is left
   * behind in a menu.
   */
  async deletePage(tenantId: string, slug: string, actor: Actor, ctx: AuditContext = {}) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    if (page.isSystem) {
      throw new BadRequestException(
        `"${page.title}" is a built-in page and cannot be deleted. Disable it to take it off the site.`,
      );
    }

    await this.drizzle.db.delete(pages).where(eq(pages.id, page.id));
    await this.removeNavigationFor(tenantId, slug);
    void this.search?.removeEntity?.(tenantId, 'page', page.id);

    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.delete',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, title: page.title, status: page.status },
      ...ctx,
    });
    return { deleted: true, slug };
  }

  /**
   * Copy a page — layout, SEO and template — under a new slug.
   *
   * The copy always starts as a draft: duplicating a published page and having
   * the copy go live untouched is how a site loses content control.
   */
  async duplicatePage(
    tenantId: string,
    slug: string,
    dto: { slug: string; title?: string },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const source = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    if (!source) throw new NotFoundException(`Page "${slug}" not found`);

    const created = await this.createPage(
      tenantId,
      { slug: dto.slug, title: dto.title ?? `${source.title} (copy)`, template: source.template ?? undefined },
      actor,
      ctx,
    );
    // createPage seeded a template; overwrite it with the source layout.
    const [updated] = await this.drizzle.db
      .update(pages)
      .set({
        layout: migrateLegacyLayout(source.layout as PageLayout),
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        translations: source.translations,
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, created!.id))
      .returning();

    return updated;
  }

  async savePage(
    tenantId: string,
    slug: string,
    dto: { layout: unknown; title?: string },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const layout = this.parsePageLayout(dto.layout as PageLayout);
    const page = await this.getPage(tenantId, slug);

    const [updated] = await this.drizzle.db
      .update(pages)
      .set({
        layout,
        title: dto.title?.trim() || page.title,
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id))
      .returning();

    if (updated) this.syncSearch(tenantId, updated.id);
    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.save',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, blockCount: layout.content.length, status: 'draft' },
      ...ctx,
    });
    return updated;
  }

  async publishPage(
    tenantId: string,
    slug: string,
    dto: { layout?: unknown; title?: string; note?: string },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const page = await this.getPage(tenantId, slug);
    // Publish the canvas payload when the client provides it. Saving the draft,
    // creating the immutable snapshot, and moving the publication pointer happen
    // in one transaction so the UI can never report a stale version as live.
    const layout = this.parsePageLayout(dto.layout ?? page.layout);
    const title = dto.title?.trim() || page.title;
    const note = dto.note?.trim() || null;
    const nextVersion = page.version + 1;
    const now = new Date();

    const updated = await this.drizzle.db.transaction(async (tx) => {
      await tx.insert(pageVersions).values({
        pageId: page.id,
        tenantId,
        version: nextVersion,
        layout,
        status: 'published',
        note,
        changedById: actor.id,
      });

      const [published] = await tx
        .update(pages)
        .set({
          layout,
          title,
          status: 'published',
          version: nextVersion,
          publishedAt: now,
          publishedById: actor.id,
          updatedById: actor.id,
          updatedAt: now,
        })
        .where(eq(pages.id, page.id))
        .returning();

      if (!published) throw new NotFoundException(`Page "${slug}" no longer exists`);
      return published;
    });

    if (updated) this.syncSearch(tenantId, updated.id);
    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.publish',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, version: nextVersion, blockCount: layout.content.length, note },
      ...ctx,
    });
    return updated;
  }

  async revertPage(tenantId: string, slug: string, version: number, actor: Actor, ctx: AuditContext = {}) {
    const page = await this.getPage(tenantId, slug);
    const snapshot = await this.drizzle.db.query.pageVersions.findFirst({
      where: and(eq(pageVersions.pageId, page.id), eq(pageVersions.version, version)),
    });
    if (!snapshot) throw new NotFoundException(`Version ${version} not found for page "${slug}"`);

    const [updated] = await this.drizzle.db
      .update(pages)
      .set({
        layout: snapshot.layout,
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id))
      .returning();

    if (updated) this.syncSearch(tenantId, updated.id);
    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.revert',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, fromVersion: page.version, toVersion: version },
      ...ctx,
    });
    return updated;
  }

  async resetPage(tenantId: string, slug: string, actor: Actor, ctx: AuditContext = {}) {
    const page = await this.getPage(tenantId, slug);
    const [updated] = await this.drizzle.db
      .update(pages)
      .set({
        layout: getDefaultLayout(slug),
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id))
      .returning();

    if (updated) this.syncSearch(tenantId, updated.id);
    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.reset',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug },
      ...ctx,
    });
    return updated;
  }

  async getPageVersions(tenantId: string, slug: string) {
    const page = await this.getPage(tenantId, slug);
    const rows = await this.drizzle.db.query.pageVersions.findMany({
      where: eq(pageVersions.pageId, page.id),
      orderBy: [desc(pageVersions.version)],
      with: { changedBy: { columns: { name: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      tenantId: row.tenantId,
      version: row.version,
      layout: row.layout,
      status: row.status,
      note: row.note,
      changedById: row.changedById,
      changedByName: row.changedBy?.name || row.changedBy?.email || null,
      createdAt: row.createdAt,
    }));
  }

  // ------------------------------------------------------------------
  // Saved sections (reusable section library)
  // ------------------------------------------------------------------

  private parseSavedSection(dto: { name: string; node: unknown; zones?: unknown }) {
    const parsed = savedSectionSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid saved section: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      );
    }
    // Persist the canonical slot shape (legacy flat zones merged inline).
    const node = inlineSectionZones(
      parsed.data.node as PuckNode,
      parsed.data.zones as Record<string, PuckNode[]>,
    );
    return { ...parsed.data, node, zones: {} as Record<string, PuckNode[]> };
  }

  async listSavedSections(tenantId: string) {
    const rows = await this.drizzle.db.query.savedSections.findMany({
      where: eq(savedSections.tenantId, tenantId),
      orderBy: [desc(savedSections.createdAt)],
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      node: inlineSectionZones(
        row.node as PuckNode,
        row.zones as unknown as Record<string, PuckNode[]>,
      ),
      zones: {},
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async saveSavedSection(
    tenantId: string,
    dto: { name: string; node: unknown; zones?: unknown },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const parsed = this.parseSavedSection(dto);
    const [created] = await this.drizzle.db
      .insert(savedSections)
      .values({
        tenantId,
        name: parsed.name.trim(),
        node: parsed.node as PuckNode,
        zones: parsed.zones as Record<string, PuckNode[]>,
        createdById: actor.id,
      })
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.section.save',
      entityType: 'saved_section',
      entityId: created?.id,
      tenantId,
      details: { name: created?.name, nodeType: created?.node.type },
      ...ctx,
    });
    return created;
  }

  async renameSavedSection(
    tenantId: string,
    id: string,
    dto: { name: string },
    actor: Actor,
    ctx: AuditContext = {},
  ) {
    const existing = await this.drizzle.db.query.savedSections.findFirst({
      where: and(eq(savedSections.id, id), eq(savedSections.tenantId, tenantId)),
    });
    if (!existing) throw new NotFoundException('Saved section not found');

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name cannot be empty');

    const [updated] = await this.drizzle.db
      .update(savedSections)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(savedSections.id, id), eq(savedSections.tenantId, tenantId)))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.section.rename',
      entityType: 'saved_section',
      entityId: id,
      tenantId,
      details: { from: existing.name, to: updated?.name },
      ...ctx,
    });
    return updated;
  }

  async deleteSavedSection(tenantId: string, id: string, actor: Actor, ctx: AuditContext = {}) {
    const [deleted] = await this.drizzle.db
      .delete(savedSections)
      .where(and(eq(savedSections.id, id), eq(savedSections.tenantId, tenantId)))
      .returning();
    if (!deleted) throw new NotFoundException('Saved section not found');

    await this.audit.log({
      userId: actor.id,
      action: 'builder.section.delete',
      entityType: 'saved_section',
      entityId: id,
      tenantId,
      details: { name: deleted.name },
      ...ctx,
    });
    return { id: deleted.id, deleted: true };
  }

  // ------------------------------------------------------------------
  // Themes
  // ------------------------------------------------------------------

  async getTheme(tenantId: string) {
    const theme = await this.drizzle.db.query.themes.findFirst({
      where: eq(themes.tenantId, tenantId),
    });
    if (theme) return theme;
    const created = await this.provisionTheme(tenantId);
    if (!created) throw new NotFoundException('Failed to provision theme');
    return created;
  }

  async saveTheme(tenantId: string, dto: { tokens: unknown; name?: string }, actor: Actor, ctx: AuditContext = {}) {
    const tokens = this.parseThemeTokens(dto.tokens);
    const theme = await this.getTheme(tenantId);

    const [updated] = await this.drizzle.db
      .update(themes)
      .set({
        tokens,
        name: dto.name?.trim() || theme.name || DEFAULT_THEME_NAME,
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, theme.id))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.theme.save',
      entityType: 'theme',
      entityId: theme.id,
      tenantId,
      details: { status: 'draft', fonts: tokens.fonts, radius: tokens.radius },
      ...ctx,
    });
    return updated;
  }

  async publishTheme(tenantId: string, actor: Actor, ctx: AuditContext = {}) {
    const theme = await this.getTheme(tenantId);
    // Hard validation gate: only valid tokens can be published.
    const tokens = this.parseThemeTokens(theme.tokens);

    const nextVersion = theme.version + 1;
    await this.drizzle.db.insert(themeVersions).values({
      themeId: theme.id,
      tenantId,
      version: nextVersion,
      tokens,
      status: 'published',
      changedById: actor.id,
    });

    const [updated] = await this.drizzle.db
      .update(themes)
      .set({
        status: 'published',
        version: nextVersion,
        publishedAt: new Date(),
        publishedById: actor.id,
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, theme.id))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.theme.publish',
      entityType: 'theme',
      entityId: theme.id,
      tenantId,
      details: { version: nextVersion },
      ...ctx,
    });
    return updated;
  }

  async revertTheme(tenantId: string, version: number, actor: Actor, ctx: AuditContext = {}) {
    const theme = await this.getTheme(tenantId);
    const snapshot = await this.drizzle.db.query.themeVersions.findFirst({
      where: and(eq(themeVersions.themeId, theme.id), eq(themeVersions.version, version)),
    });
    if (!snapshot) throw new NotFoundException(`Theme version ${version} not found`);

    const [updated] = await this.drizzle.db
      .update(themes)
      .set({
        tokens: snapshot.tokens,
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, theme.id))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.theme.revert',
      entityType: 'theme',
      entityId: theme.id,
      tenantId,
      details: { fromVersion: theme.version, toVersion: version },
      ...ctx,
    });
    return updated;
  }

  async resetTheme(tenantId: string, actor: Actor, ctx: AuditContext = {}) {
    const theme = await this.getTheme(tenantId);
    const [updated] = await this.drizzle.db
      .update(themes)
      .set({
        tokens: DEFAULT_THEME_TOKENS,
        name: DEFAULT_THEME_NAME,
        status: 'draft',
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, theme.id))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.theme.reset',
      entityType: 'theme',
      entityId: theme.id,
      tenantId,
      details: {},
      ...ctx,
    });
    return updated;
  }

  async getThemeVersions(tenantId: string) {
    const theme = await this.getTheme(tenantId);
    const rows = await this.drizzle.db.query.themeVersions.findMany({
      where: eq(themeVersions.themeId, theme.id),
      orderBy: [desc(themeVersions.version)],
      with: { changedBy: { columns: { name: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      themeId: row.themeId,
      tenantId: row.tenantId,
      version: row.version,
      tokens: row.tokens,
      status: row.status,
      changedById: row.changedById,
      changedByName: row.changedBy?.name || row.changedBy?.email || null,
      createdAt: row.createdAt,
    }));
  }

  // ------------------------------------------------------------------
  // Provisioning
  // ------------------------------------------------------------------

  private defaultTitle(slug: string): string {
    const def = BUILDER_PAGE_DEFS.find((d) => d.slug === slug);
    return def?.title ?? slug;
  }

  /**
   * Create a seeded page for a tenant that does not have it yet.
   *
   * Restricted to the known system slugs on purpose. This used to insert
   * whatever slug it was handed, which combined with a dynamic public `[slug]`
   * route would have created a page for any URL a visitor guessed — and
   * `is_system` stops the seeded pages from being deleted later.
   */
  private async provisionPage(tenantId: string, slug: string) {
    if (!BUILDER_PAGE_SLUGS.includes(slug as (typeof BUILDER_PAGE_SLUGS)[number])) return null;
    const [created] = await this.drizzle.db
      .insert(pages)
      .values({
        tenantId,
        slug,
        title: this.defaultTitle(slug),
        layout: getDefaultLayout(slug),
        isSystem: true,
      })
      .returning();
    return created;
  }

  private async provisionTheme(tenantId: string) {
    const [created] = await this.drizzle.db
      .insert(themes)
      .values({
        tenantId,
        name: DEFAULT_THEME_NAME,
        tokens: DEFAULT_THEME_TOKENS,
        isDefault: true,
      })
      .returning();
    return created;
  }
}
