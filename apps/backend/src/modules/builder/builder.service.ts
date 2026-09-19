import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc, asc } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { pages, pageVersions } from '../../database/schema/pages';
import { savedSections } from '../../database/schema/saved-sections';
import { themes, themeVersions } from '../../database/schema/themes';
import { AuditService } from '../auth/services/audit.service';
import {
  validatePageLayout,
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
  ) {}

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

  async listPages(tenantId: string) {
    return this.drizzle.db.query.pages.findMany({
      where: eq(pages.tenantId, tenantId),
      orderBy: [asc(pages.createdAt)],
    });
  }

  async getPage(tenantId: string, slug: string) {
    const page = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)),
    });
    // Serve the canonical slot shape: legacy DropZone-era rows (flat `zones`
    // map) are migrated on read until they are re-saved.
    if (page) return { ...page, layout: migrateLegacyLayout(page.layout as PageLayout) };
    const created = await this.provisionPage(tenantId, slug);
    if (!created) throw new NotFoundException('Failed to provision page');
    return { ...created, layout: created.layout };
  }

  async createPage(tenantId: string, dto: { slug: string; title?: string }, actor: Actor, ctx: AuditContext = {}) {
    const existing = await this.drizzle.db.query.pages.findFirst({
      where: and(eq(pages.tenantId, tenantId), eq(pages.slug, dto.slug)),
    });
    if (existing) throw new BadRequestException(`Page "${dto.slug}" already exists`);

    const [created] = await this.drizzle.db
      .insert(pages)
      .values({
        tenantId,
        slug: dto.slug,
        title: dto.title || this.defaultTitle(dto.slug),
        layout: getDefaultLayout(dto.slug),
        updatedById: actor.id,
      })
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.create',
      entityType: 'page',
      entityId: created?.id,
      tenantId,
      details: { slug: dto.slug, title: created?.title },
      ...ctx,
    });
    return created;
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

  async publishPage(tenantId: string, slug: string, actor: Actor, note?: string, ctx: AuditContext = {}) {
    const page = await this.getPage(tenantId, slug);
    // Hard validation gate: a broken layout can never be published.
    const layout = this.parsePageLayout(page.layout);

    const nextVersion = page.version + 1;
    await this.drizzle.db.insert(pageVersions).values({
      pageId: page.id,
      tenantId,
      version: nextVersion,
      layout,
      status: 'published',
      note: note?.trim() || null,
      changedById: actor.id,
    });

    const [updated] = await this.drizzle.db
      .update(pages)
      .set({
        status: 'published',
        version: nextVersion,
        publishedAt: new Date(),
        publishedById: actor.id,
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id))
      .returning();

    await this.audit.log({
      userId: actor.id,
      action: 'builder.page.publish',
      entityType: 'page',
      entityId: page.id,
      tenantId,
      details: { slug, version: nextVersion, blockCount: layout.content.length, note: note?.trim() || null },
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

  private async provisionPage(tenantId: string, slug: string) {
    const [created] = await this.drizzle.db
      .insert(pages)
      .values({
        tenantId,
        slug,
        title: this.defaultTitle(slug),
        layout: getDefaultLayout(slug),
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
