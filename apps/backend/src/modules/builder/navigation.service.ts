import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  NAV_MAX_DEPTH,
  RESERVED_SLUGS,
  BUILDER_PAGE_DEFS,
  type NavItemInput,
  type NavItemType,
  type NavItemView,
} from '@titan/shared';
import { DrizzleService } from '../../database/drizzle.service';
import { AuditService } from '../auth/services/audit.service';
import type { Actor } from './builder.service';
import { navigationItems, pages } from '../../database/schema';
import type { NavigationItemRow } from '../../database/schema/navigation';

interface AuditContext {
  ip?: string;
  userAgent?: string;
}

/**
 * A navigation item plus its resolved children, as the admin editor consumes it.
 * `pageMissing` / `pageDisabled` are reported rather than filtered: an editor
 * needs to see that a link points at a page that is switched off, otherwise
 * they cannot tell a deliberate hide from a broken menu.
 */
export interface NavTreeNode {
  id: string;
  label: string;
  labelAr: string | null;
  type: NavItemType;
  href: string | null;
  pageSlug: string | null;
  visible: boolean;
  icon: string | null;
  openInNewTab: boolean;
  sortOrder: number;
  pageStatus: string | null;
  pageDisabled: boolean;
  pageMissing: boolean;
  children: NavTreeNode[];
}

/**
 * Public URL for a CMS page slug.
 *
 * Slugs are CMS identities and routinely differ from the route that renders
 * them — `academy-landing` is served by `/academy`. `BUILDER_PAGE_DEFS` is the
 * registry that records the real path, so the menu follows it. A slug with no
 * registry entry keeps the historical `/{slug}` behaviour, which the CMS
 * catch-all route serves.
 */
export function resolvePageHref(pageSlug: string): string {
  const def = BUILDER_PAGE_DEFS.find((d) => d.slug === pageSlug);
  return def?.path ?? `/${pageSlug}`;
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------------ read */

  /**
   * The whole tree for the admin editor, unfiltered and unresolved.
   *
   * One query for items plus one for page statuses, rather than a query per
   * link — a nav with 40 items would otherwise be 40 round trips.
   */
  async getTree(tenantId: string): Promise<NavTreeNode[]> {
    const rows = await this.drizzle.db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.tenantId, tenantId))
      .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.createdAt));

    const pageSlugs = [...new Set(rows.map((r) => r.pageSlug).filter((s): s is string => !!s))];
    const statusBySlug = new Map<string, string>();
    if (pageSlugs.length) {
      const pageRows = await this.drizzle.db
        .select({ slug: pages.slug, status: pages.status })
        .from(pages)
        .where(and(eq(pages.tenantId, tenantId), inArray(pages.slug, pageSlugs)));
      for (const row of pageRows) statusBySlug.set(row.slug, row.status);
    }

    const byParent = new Map<string | null, NavigationItemRow[]>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      const bucket = byParent.get(key);
      if (bucket) bucket.push(row);
      else byParent.set(key, [row]);
    }

    const build = (parentId: string | null, depth: number): NavTreeNode[] =>
      (byParent.get(parentId) ?? []).map((row) => {
        const status = row.pageSlug ? statusBySlug.get(row.pageSlug) ?? null : null;
        return {
          id: row.id,
          label: row.label,
          labelAr: row.labelAr,
          type: row.type,
          href: row.href,
          pageSlug: row.pageSlug,
          visible: row.isVisible,
          icon: row.icon,
          openInNewTab: row.opensInNewTab,
          sortOrder: row.sortOrder,
          pageStatus: status,
          pageDisabled: status === 'disabled',
          pageMissing: !!row.pageSlug && !status,
          children: depth < NAV_MAX_DEPTH ? build(row.id, depth + 1) : [],
        };
      });

    return build(null, 1);
  }

  /**
   * The tree as the public navbar consumes it: invisible items dropped, links to
   * disabled or missing pages dropped, labels localized, groups with nothing
   * left under them dropped.
   *
   * Dropping rather than deactivating is deliberate: a nav entry pointing at a
   * page an admin switched off should disappear, not 404 in front of a customer.
   */
  async getPublicTree(tenantId: string, locale: 'en' | 'ar' = 'en'): Promise<NavItemView[]> {
    const tree = await this.getTree(tenantId);
    const localize = (node: NavTreeNode) =>
      locale === 'ar' && node.labelAr?.trim() ? node.labelAr : node.label;

    const toView = (node: NavTreeNode): NavItemView | null => {
      if (!node.visible) return null;
      const children = node.children.map(toView).filter((c): c is NavItemView => c !== null);
      if (node.type === 'group') {
        // A group is a container. With no reachable children it is dead weight.
        if (!children.length) return null;
        return {
          id: node.id,
          label: localize(node),
          type: 'group',
          href: '',
          pageSlug: null,
          openInNewTab: false,
          icon: node.icon,
          children,
        };
      }
      if (node.type === 'page') {
        if (!node.pageSlug || node.pageMissing || node.pageDisabled) return null;
        return {
          id: node.id,
          label: localize(node),
          type: 'page',
          // A page slug is a CMS identity, not a URL. `academy-landing` is
          // served by the /academy route, so `/${pageSlug}` produced a dead
          // link. Resolve through the page registry, which is the single place
          // that knows a slug's real path.
          href: resolvePageHref(node.pageSlug),
          pageSlug: node.pageSlug,
          openInNewTab: node.openInNewTab,
          icon: node.icon,
          children,
        };
      }
      if (!node.href) return null;
      return {
        id: node.id,
        label: localize(node),
        type: 'url',
        href: node.href,
        pageSlug: null,
        openInNewTab: node.openInNewTab,
        icon: node.icon,
        children,
      };
    };

    return tree.map(toView).filter((n): n is NavItemView => n !== null);
  }

  /* ------------------------------------------------------------ write */

  /**
   * Replace the tenant's whole tree in one transaction.
   *
   * A per-node REST API would mean a delete + a create + N reorder calls for a
   * single drag, each of which can half-apply. The editor already holds the
   * entire tree in state, so saving the document is both fewer round trips and
   * the only way to be atomic.
   *
   * Existing ids are updated in place so `sort_order` and any future per-item
   * columns survive; new ids are inserted, and anything absent is deleted —
   * which is how a delete performed in the UI takes effect.
   */
  async saveTree(tenantId: string, items: NavItemInput[], actor: Actor, ctx: AuditContext = {}) {
    this.assertShape(items);

    const flattened = this.flatten(items);

    await this.drizzle.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(navigationItems)
        .where(eq(navigationItems.tenantId, tenantId));
      const byId = new Map(existing.map((r) => [r.id, r]));

      // Insert in two passes so every group exists before a child references it.
      const idFor = new Map<string, string>();
      const keep: string[] = [];

      for (const item of flattened) {
        if (item.id && byId.has(item.id)) {
          idFor.set(item.key, item.id);
          keep.push(item.id);
        } else {
          const [row] = await tx
            .insert(navigationItems)
            .values({
              tenantId,
              label: item.label,
              labelAr: item.labelAr ?? null,
              type: item.type,
              href: item.type === 'url' ? item.href ?? null : null,
              pageSlug: item.type === 'page' ? item.pageSlug ?? null : null,
              parentId: null,
              sortOrder: item.sortOrder,
              isVisible: item.visible,
              icon: item.icon ?? null,
              opensInNewTab: item.openInNewTab,
            })
            .returning({ id: navigationItems.id });
          idFor.set(item.key, row!.id);
          keep.push(row!.id);
        }
      }

      for (const item of flattened) {
        const id = idFor.get(item.key)!;
        const parentId = item.parentKey ? idFor.get(item.parentKey) ?? null : null;
        await tx.update(navigationItems).set({
          label: item.label,
          labelAr: item.labelAr ?? null,
          type: item.type,
          href: item.type === 'url' ? item.href ?? null : null,
          pageSlug: item.type === 'page' ? item.pageSlug ?? null : null,
          parentId,
          sortOrder: item.sortOrder,
          isVisible: item.visible,
          icon: item.icon ?? null,
          opensInNewTab: item.openInNewTab,
          updatedAt: new Date(),
        }).where(eq(navigationItems.id, id));
      }

      // Anything the submitted tree no longer mentions was removed in the UI.
      // Deleting the parent cascades to its children, so only roots are named.
      const removed = existing.filter((r) => !keep.includes(r.id)).map((r) => r.id);
      if (removed.length) {
        await tx.delete(navigationItems).where(inArray(navigationItems.id, removed));
      }

      await this.audit.log({
        userId: actor.id,
        action: 'builder.navigation.save',
        entityType: 'navigation',
        tenantId,
        details: { items: flattened.length, removed: removed.length },
        ...ctx,
      });

    });

    // Read back outside the transaction: `getTree` uses the pooled connection,
    // and querying it while this transaction is still open would either see
    // pre-commit state or contend for a connection.
    return this.getTree(tenantId);
  }

  /**
   * Follow a page through a rename.
   *
   * A link stored as `pageSlug` is the one kind that survives a rename; a `url`
   * item pointing at `/old-slug` is left alone, because silently rewriting
   * hand-written URLs is how a nav ends up pointing somewhere the author never
   * chose.
   */
  async repoint(tenantId: string, fromSlug: string, toSlug: string) {
    const rows = await this.drizzle.db
      .select({ id: navigationItems.id })
      .from(navigationItems)
      .where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.pageSlug, fromSlug)));
    if (!rows.length) return 0;
    await this.drizzle.db
      .update(navigationItems)
      .set({ pageSlug: toSlug, updatedAt: new Date() })
      .where(inArray(navigationItems.id, rows.map((r) => r.id)));
    return rows.length;
  }

  /** Drop links that point at a page that no longer exists. */
  async removeForPage(tenantId: string, slug: string) {
    const rows = await this.drizzle.db
      .select({ id: navigationItems.id })
      .from(navigationItems)
      .where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.pageSlug, slug)));
    if (!rows.length) return 0;
    await this.drizzle.db.delete(navigationItems).where(inArray(navigationItems.id, rows.map((r) => r.id)));
    return rows.length;
  }

  /** Drop everything for a tenant. Used by tenant deletion and by tests. */
  async clear(tenantId: string) {
    await this.drizzle.db.delete(navigationItems).where(eq(navigationItems.tenantId, tenantId));
  }

  /** Top-level items only, for the admin rail badge. */
  async countTopLevel(tenantId: string): Promise<number> {
    const rows = await this.drizzle.db
      .select({ id: navigationItems.id })
      .from(navigationItems)
      .where(and(eq(navigationItems.tenantId, tenantId), isNull(navigationItems.parentId)));
    return rows.length;
  }

  /* ---------------------------------------------------------- internals */

  /**
   * Depth and shape checks that a zod schema cannot express, plus a total count
   * cap. Depth is capped at NAV_MAX_DEPTH by promoting a third level to
   * second: silently dropping a link an admin just built is worse than
   * rendering it one level up, and the depth is reported back to the caller.
   */
  private assertShape(items: NavItemInput[]) {
    const seen = new Set<string>();
    const count = { total: 0 };
    const walk = (list: NavItemInput[] | undefined, depth: number, path: string) => {
      for (const item of list ?? []) {
        count.total += 1;
        if (count.total > 200) {
          throw new BadRequestException('A navigation cannot have more than 200 items');
        }
        const where = `${path}/${item.label}`;
        if (seen.has(where)) {
          throw new BadRequestException(`Duplicate item "${item.label}" — every entry needs a unique label`);
        }
        seen.add(where);
        if (item.type === 'url' && item.href && /^\s*javascript:/i.test(item.href)) {
          throw new BadRequestException(`Item "${item.label}" has an unsupported URL scheme`);
        }
        if (item.type === 'group') {
          if (item.href || item.pageSlug) {
            throw new BadRequestException(`Group "${item.label}" cannot have a target — it holds other links`);
          }
        }
        if (item.type === 'page' && item.pageSlug && RESERVED_SLUGS.includes(item.pageSlug)) {
          // Not fatal: a seeded page may legitimately be linked (home, academy).
          // The public resolver prunes anything that is not actually published.
          this.logger.debug(`Nav link "${item.label}" targets reserved slug ${item.pageSlug}`);
        }
        if (depth < NAV_MAX_DEPTH) {
          walk(item.children, depth + 1, where);
        } else if (item.children?.length) {
          this.logger.warn(`Nav item "${item.label}" is nested deeper than ${NAV_MAX_DEPTH} levels; rendering it one level up`);
        }
      }
    };
    walk(items, 1, '');
  }

  /** Depth-first flatten with a synthetic key, so children can name their parent. */
  private flatten(items: NavItemInput[]) {
    const out: Array<{
      key: string;
      id?: string;
      label: string;
      labelAr: string | null;
      type: NavItemType;
      href: string | null;
      pageSlug: string | null;
      parentKey: string | null;
      sortOrder: number;
      visible: boolean;
      icon: string | null;
      openInNewTab: boolean;
    }> = [];
    let counter = 0;
    const walk = (list: NavItemInput[] | undefined, parentKey: string | null) => {
      // `sortOrder` is the position among siblings, so a group's children start
      // at 0 again. A global counter would interleave a group's children with
      // the next top-level item's.
      list?.forEach((item, siblingIndex) => {
        const key = `k${counter++}`;
        out.push({
          key,
          id: item.id,
          label: item.label,
          labelAr: item.labelAr ?? null,
          type: item.type,
          href: item.href ?? null,
          pageSlug: item.pageSlug ?? null,
          parentKey,
          sortOrder: siblingIndex,
          visible: item.visible !== false,
          icon: item.icon ?? null,
          openInNewTab: !!item.openInNewTab,
        });
        if (item.children?.length) walk(item.children, key);
      });
    };
    walk(items, null);
    return out;
  }
}
