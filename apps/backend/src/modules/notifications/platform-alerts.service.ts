import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { notifications, platformNotificationPrefs, tenants, users } from '../../database/schema';
import { AuditService } from '../auth/services/audit.service';
import {
  PLATFORM_ALERT_GROUPS,
  isPlatformAlertGroup,
  mergePlatformPrefs,
  platformAlertGroup,
  type PlatformAlertSeverity,
} from './platform-alert-groups';

/**
 * Platform-critical alerting for super admins.
 *
 * Deliberately separate from `NotificationsService`. That service is a personal
 * feed: it is tenant-scoped, honours the reader's personal preferences, and
 * dedupes per tenant+user. None of that fits a platform signal, which is filed
 * under the tenant that *caused* it and delivered to every super admin who has
 * not muted its group.
 *
 * Recipients are resolved from the `users` table rather than configured, so
 * granting super admin immediately starts the delivery and revoking it stops
 * delivery without a separate membership table to keep in sync.
 */
@Injectable()
export class PlatformAlertsService {
  private readonly logger = new Logger(PlatformAlertsService.name);

  constructor(
    private drizzle: DrizzleService,
    @Optional() private audit?: AuditService,
  ) {}

  /** Everyone currently holding the super_admin role, across all tenants. */
  private async superAdminIds(): Promise<string[]> {
    const rows = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'super_admin'));
    return rows.map((r) => r.id);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const row = await this.drizzle.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row[0]?.role === 'super_admin';
  }

  private assertSuperAdmin(actor: { id: string; role?: string }) {
    if (actor.role !== 'super_admin') {
      // 403 rather than 404: whether the platform feed exists is not a secret,
      // and a clear refusal beats a confusing empty screen.
      throw new ForbiddenException('Platform alerts are restricted to super admins');
    }
  }

  // ------------------------------------------------------------------
  // Preferences
  // ------------------------------------------------------------------

  async getPrefs(userId: string): Promise<Record<string, boolean>> {
    const row = await this.drizzle.db
      .select({ prefs: platformNotificationPrefs.prefs })
      .from(platformNotificationPrefs)
      .where(eq(platformNotificationPrefs.userId, userId))
      .limit(1);
    return mergePlatformPrefs(row[0]?.prefs as Record<string, unknown> | null);
  }

  async updatePrefs(
    actor: { id: string; role?: string },
    incoming: Record<string, boolean>,
    ip?: string,
    userAgent?: string,
  ): Promise<Record<string, boolean>> {
    this.assertSuperAdmin(actor);
    const rejected = Object.keys(incoming ?? {}).filter((k) => !isPlatformAlertGroup(k));
    if (rejected.length) {
      throw new BadRequestException(`Unknown alert group(s): ${rejected.join(', ')}`);
    }
    const merged = mergePlatformPrefs({
      ...(await this.getPrefs(actor.id)),
      ...incoming,
    });
    const [saved] = await this.drizzle.db
      .insert(platformNotificationPrefs)
      .values({ userId: actor.id, prefs: merged, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformNotificationPrefs.userId,
        set: { prefs: merged, updatedAt: new Date() },
      })
      .returning({ prefs: platformNotificationPrefs.prefs });
    await this.audit?.log({
      userId: actor.id,
      action: 'platform_alerts:prefs_update',
      entityType: 'platform_notification_prefs',
      entityId: actor.id,
      details: { prefs: merged },
      ip,
      userAgent,
    });
    return (saved?.prefs as Record<string, boolean>) ?? merged;
  }

  /** The group registry, annotated with this super admin's current toggles. */
  async settings(actor: { id: string; role?: string }) {
    this.assertSuperAdmin(actor);
    const prefs = await this.getPrefs(actor.id);
    return {
      groups: PLATFORM_ALERT_GROUPS.map((g) => ({ ...g, enabled: prefs[g.key] ?? g.defaultEnabled })),
    };
  }

  // ------------------------------------------------------------------
  // Emission
  // ------------------------------------------------------------------

  /**
   * File a platform alert for every super admin who has not muted its group.
   *
   * Returns the rows actually created so callers (and tests) can assert
   * delivery. A muted group is a normal, expected outcome, not an error.
   */
  async emit(input: {
    group: string;
    type: string;
    title: string;
    body?: string | null;
    href?: string | null;
    /** Tenant that caused the event. Retained for context on the alert row. */
    tenantId: string;
    entityType?: string;
    entityId?: string;
    /** Collapses repeats of the same underlying problem. */
    dedupeKey?: string;
    data?: Record<string, unknown>;
  }): Promise<number> {
    const group = platformAlertGroup(input.group);
    if (!group) {
      this.logger.warn(`emit called with unknown alert group "${input.group}"`);
      return 0;
    }

    const tenant = await this.drizzle.db
      .select({ name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .limit(1);
    const tenantName = tenant[0]?.name ?? 'Unknown tenant';
    const tenantSlug = tenant[0]?.slug ?? '';

    const recipients = await this.superAdminIds();
    if (recipients.length === 0) return 0;

    let created = 0;
    for (const userId of recipients) {
      const prefs = await this.getPrefs(userId);
      if (prefs[input.group] === false) continue;
      const dedupeKey = input.dedupeKey ?? `${input.group}:${input.type}:${input.entityId ?? ''}`;
      const inserted = await this.drizzle.db
        .insert(notifications)
        .values({
          tenantId: input.tenantId,
          userId,
          audience: 'platform',
          type: input.type.slice(0, 80),
          category: 'platform',
          title: input.title.slice(0, 255),
          // The originating tenant travels as a first-class field (and inside
          // `data`), not appended to the prose: the feed renders it as a chip,
          // and duplicating it here just made every card say it twice.
          body: input.body ?? null,
          href: input.href ?? `/admin/tenants/${tenantSlug}`,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          dedupeKey,
          data: {
            group: input.group,
            severity: group.severity,
            tenantName,
            tenantSlug,
            ...(input.data ?? {}),
          },
        } as never)
        .onConflictDoNothing({
          target: [notifications.tenantId, notifications.userId, notifications.dedupeKey],
          // The dedupe index is *partial* (`WHERE dedupe_key IS NOT NULL`), and
          // Postgres only infers a conflict target from a partial index when the
          // same predicate is restated here. Without it the insert fails with
          // "no unique or exclusion constraint matching the ON CONFLICT
          // specification" rather than silently ignoring the duplicate.
          where: sql`${notifications.dedupeKey} IS NOT NULL`,
        })
        .returning({ id: notifications.id });
      if (inserted.length) {
        created += 1;
        this.logger.log(
          `platform alert ${input.type} (${input.group}/${group.severity}) → ${inserted.length} super admin(s): ${input.title}`,
        );
      }
    }
    return created;
  }

  /** Severity is carried in `data`, so it can be changed without a migration. */
  private severityFilter(group: string | null, severity: string | null) {
    if (!group && !severity) return undefined;
    const parts: ReturnType<typeof sql>[] = [];
    if (group) parts.push(sql`(${notifications.data}->>'group') = ${group}`);
    if (severity) parts.push(sql`(${notifications.data}->>'severity') = ${severity}`);
    return parts.length === 1 ? parts[0]! : sql`${sql.join(parts, sql` and `)}`;
  }

  // ------------------------------------------------------------------
  // Read surface
  // ------------------------------------------------------------------

  async list(
    actor: { id: string; role?: string },
    options: { limit?: number; cursor?: string; unreadOnly?: boolean; group?: string; severity?: string } = {},
  ) {
    this.assertSuperAdmin(actor);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const conditions = [
      eq(notifications.userId, actor.id),
      eq(notifications.audience, 'platform'),
    ];
    if (options.unreadOnly) {
      conditions.push(or(isNull(notifications.readAt), eq(notifications.isRead, false))!);
    }
    const sev = this.severityFilter(options.group ?? null, options.severity ?? null);
    if (sev) conditions.push(sev);

    if (options.cursor) {
      const decoded = this.decodeCursor(options.cursor);
      if (decoded) {
        conditions.push(
          or(
            sql`${notifications.createdAt} < ${decoded.createdAt}`,
            and(sql`${notifications.createdAt} = ${decoded.createdAt}`, sql`${notifications.id} < ${decoded.id}`),
          )!,
        );
      }
    }

    const rows = await this.drizzle.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => this.serialize(row));
    return { items, hasMore, nextCursor: hasMore ? this.encodeCursor(items[items.length - 1]!) : null };
  }

  /** Counts for the header badge and the overview strip. */
  async overview(actor: { id: string; role?: string }) {
    this.assertSuperAdmin(actor);
    const base = and(
      eq(notifications.userId, actor.id),
      eq(notifications.audience, 'platform'),
    );
    const [unread, bySeverity, byGroup] = await Promise.all([
      this.drizzle.db
        .select({ count: count() })
        .from(notifications)
        .where(and(base, or(isNull(notifications.readAt), eq(notifications.isRead, false))!)),
      this.drizzle.db
        .select({ severity: sql<string>`(${notifications.data}->>'severity')`, count: count() })
        .from(notifications)
        .where(base)
        .groupBy(sql`(${notifications.data}->>'severity')`),
      this.drizzle.db
        .select({ group: sql<string>`(${notifications.data}->>'group')`, count: count() })
        .from(notifications)
        .where(base)
        .groupBy(sql`(${notifications.data}->>'group')`),
    ]);

    const severity = { critical: 0, warning: 0, info: 0 } as Record<PlatformAlertSeverity, number>;
    for (const row of bySeverity) {
      if (row.severity && row.severity in severity) severity[row.severity as PlatformAlertSeverity] = Number(row.count);
    }
    // Unread is what the badge shows, broken down by severity.
    const unreadBySeverity = await this.drizzle.db
      .select({ severity: sql<string>`(${notifications.data}->>'severity')`, count: count() })
      .from(notifications)
      .where(and(base, or(isNull(notifications.readAt), eq(notifications.isRead, false))!))
      .groupBy(sql`(${notifications.data}->>'severity')`);
    const unreadSeverity = { critical: 0, warning: 0, info: 0 } as Record<PlatformAlertSeverity, number>;
    for (const row of unreadBySeverity ?? []) {
      if (row.severity && row.severity in unreadSeverity) {
        unreadSeverity[row.severity as PlatformAlertSeverity] = Number(row.count);
      }
    }

    const groups: Record<string, number> = {};
    for (const row of byGroup) if (row.group) groups[row.group] = Number(row.count);

    return {
      unread: Number(unread[0]?.count ?? 0),
      total: Object.values(severity).reduce((a, b) => a + b, 0),
      severity,
      unreadBySeverity: unreadSeverity,
      byGroup: groups,
    };
  }

  async markRead(actor: { id: string; role?: string }, id: string) {
    this.assertSuperAdmin(actor);
    const updated = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, actor.id),
          eq(notifications.audience, 'platform'),
        ),
      )
      .returning();
    const row = updated?.[0];
    if (!row) throw new NotFoundException('Platform alert not found');
    return this.serialize(row);
  }

  /** Optionally scoped to one group, so a group can be "caught up" separately. */
  async markAllRead(actor: { id: string; role?: string }, group?: string) {
    this.assertSuperAdmin(actor);
    const conditions = [
      eq(notifications.userId, actor.id),
      eq(notifications.audience, 'platform'),
      or(isNull(notifications.readAt), eq(notifications.isRead, false))!,
    ];
    const sev = this.severityFilter(group ?? null, null);
    if (sev) conditions.push(sev);
    const updated = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(and(...conditions))
      .returning({ id: notifications.id });
    return { updated: updated?.length ?? 0 };
  }

  private serialize(row: typeof notifications.$inferSelect) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      body: row.body,
      href: row.href,
      entityType: row.entityType,
      entityId: row.entityId,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
      audience: row.audience,
      group: typeof data.group === 'string' ? data.group : null,
      severity:
        typeof data.severity === 'string'
          ? (data.severity as PlatformAlertSeverity)
          : 'info',
      tenantName: typeof data.tenantName === 'string' ? data.tenantName : null,
      tenantSlug: typeof data.tenantSlug === 'string' ? data.tenantSlug : null,
      data,
    };
  }

  private encodeCursor(item: { createdAt: Date | string; id: string }): string {
    const at =
      item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date(item.createdAt).toISOString();
    return Buffer.from(JSON.stringify({ at, id: item.id })).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (typeof parsed?.at === 'string' && typeof parsed?.id === 'string') {
        return { createdAt: parsed.at, id: parsed.id };
      }
    } catch {
      /* a bad cursor is treated as "start from the top" rather than an error */
    }
    return null;
  }
}
