import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { notifications } from '../../database/schema/notifications';
import { userPreferences } from '../../database/schema/user-preferences';
import { users } from '../../database/schema/users';
import { WsGateway } from '../ws/ws.gateway';
import { UserPreferencesService } from '../auth/services/user-preferences.service';
import { EmailService } from '../auth/services/email.service';
import { ConfigService } from '../../config/config.service';

export type NotificationCategory = 'social' | 'learning' | 'commerce' | 'messages' | 'security' | 'system' | string;

export interface NotificationInput {
  userId?: string;
  recipientId?: string;
  tenantId?: string;
  type: string;
  category?: string;
  title: string;
  body?: string | null;
  href?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: Date | null;
  isRead?: boolean;
  data?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  dedupeKey?: string | null;
  inApp?: boolean;
  forceInApp?: boolean;
  email?: boolean;
  sendEmail?: boolean;
  forceEmail?: boolean;
}

export type TenantNotificationInput = Omit<NotificationInput, 'userId' | 'recipientId'>;
export type UserNotificationInput = NotificationInput & { userId: string };

export interface NotificationPageOptions {
  limit?: number | string;
  cursor?: string;
  unreadOnly?: boolean;
  tenantId?: string;
}

export type NotificationRecord = Omit<typeof notifications.$inferSelect, 'data' | 'meta'> & {
  isRead: boolean;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
};

const DEFAULT_IN_APP: Record<string, boolean> = {
  social: true,
  learning: true,
  commerce: true,
  messages: true,
  security: true,
  system: true,
};

const DEFAULT_EMAIL: Record<string, boolean> = {
  social: false,
  learning: true,
  commerce: true,
  messages: false,
  security: true,
  system: false,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private drizzle: DrizzleService,
    private wsGateway: WsGateway,
    @Optional() private preferences?: UserPreferencesService,
    @Optional() private emailService?: EmailService,
    @Optional() private config?: ConfigService,
  ) {}

  async findByUser(userId: string): Promise<NotificationRecord[]> {
    const result = await this.list(userId, { limit: 50 });
    return result.items;
  }

  async list(userId: string, options: NotificationPageOptions = {}) {
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    // This is the *personal* feed. Platform-critical alerts live in the same
    // table but belong to the separate `/admin/platform-alerts` surface, and a
    // super admin receives both, so the audience is filtered explicitly rather
    // than inferred from the tenant: a platform alert caused by the reader's
    // own tenant would otherwise pass a tenant-only filter and leak in.
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.audience, 'personal'),
    ];
    if (options.tenantId) conditions.push(eq(notifications.tenantId, options.tenantId));
    if (options.unreadOnly) conditions.push(or(isNull(notifications.readAt), eq(notifications.isRead, false))!);
    if (options.cursor) {
      const cursor = this.decodeCursor(options.cursor);
      conditions.push(or(
        lt(notifications.createdAt, cursor.createdAt),
        and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id)),
      )!);
    }

    const rows = await this.drizzle.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => this.serialize(row));
    const last = items[items.length - 1];
    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? this.encodeCursor(last) : null,
    };
  }

  async unreadCount(userId: string, tenantId?: string) {
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.audience, 'personal'),
      or(isNull(notifications.readAt), eq(notifications.isRead, false)),
    ];
    if (tenantId) conditions.push(eq(notifications.tenantId, tenantId));
    const [result] = await this.drizzle.db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));
    return Number(result?.count ?? 0);
  }

  async markRead(userId: string, id?: string, tenantId?: string) {
    const notificationId = id;
    if (!userId || !notificationId) {
      throw new BadRequestException('Notification owner and id are required');
    }
    const conditions = [
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId),
      // A personal "mark read" must never clear a platform alert.
      eq(notifications.audience, 'personal'),
    ];
    if (tenantId) conditions.push(eq(notifications.tenantId, tenantId));
    const [updated] = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(and(...conditions))
      .returning();
    if (!updated) throw new NotFoundException('Notification not found');
    const count = await this.unreadCount(userId, tenantId);
    this.emitUnreadCount(userId, count);
    return this.serialize(updated);
  }

  async markAllRead(userId: string, tenantId?: string) {
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.audience, 'personal'),
      or(isNull(notifications.readAt), eq(notifications.isRead, false)),
    ];
    if (tenantId) conditions.push(eq(notifications.tenantId, tenantId));
    const updated = await this.drizzle.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`COALESCE(${notifications.readAt}, now())` })
      .where(and(...conditions))
      .returning({ id: notifications.id });
    this.emitUnreadCount(userId, 0);
    return { updated: updated.length };
  }

  async create(data: NotificationInput): Promise<NotificationRecord | null> {
    return this.notifyUser(data);
  }

  async notifyUser(userId: string, input: TenantNotificationInput): Promise<NotificationRecord | null>;
  async notifyUser(input: UserNotificationInput): Promise<NotificationRecord | null>;
  async notifyUser(input: NotificationInput): Promise<NotificationRecord | null>;
  async notifyUser(userIdOrInput: string | NotificationInput, input?: TenantNotificationInput): Promise<NotificationRecord | null> {
    let normalized: NotificationInput;
    if (typeof userIdOrInput === 'string') {
      if (!input) return null;
      normalized = { ...input, userId: userIdOrInput, type: input.type, title: input.title };
    } else {
      normalized = userIdOrInput;
    }
    try {
      return await this.createNotification(normalized);
    } catch (error) {
      this.logger.warn(`Notification creation failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async notifyTenantAdmins(tenantId: string, input: TenantNotificationInput): Promise<NotificationRecord[]> {
    try {
      const admins = await this.drizzle.db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          inArray(users.role, ['admin', 'super_admin', 'staff', 'moderator']),
          eq(users.isActive, true),
          ne(users.accountStatus, 'deleted'),
          ne(users.accountStatus, 'suspended'),
        ));
      const results = await Promise.all(admins.map((admin) => this.notifyUser({ ...input, userId: admin.id, tenantId })));
      return results.filter((result): result is NotificationRecord => result !== null);
    } catch (error) {
      this.logger.warn(`Tenant admin notification failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async createNotification(input: NotificationInput): Promise<NotificationRecord | null> {
    const recipientId = input.userId ?? input.recipientId;
    if (!recipientId || !input.type || !input.title) return null;

    const recipient = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, recipientId),
    });
    if (!recipient) return null;
    if (input.tenantId && String(input.tenantId) !== String(recipient.tenantId)) return null;
    const tenantId = recipient.tenantId;

    const sourceData = this.objectValue(input.data);
    const sourceMeta = this.objectValue(input.meta);
    const legacy = { ...sourceData, ...sourceMeta };
    const category = this.categoryFor(input.category, input.type);
    const type = String(input.type).trim().slice(0, 80);
    const title = String(input.title).trim().slice(0, 255);
    if (!title) return null;
    const href = this.optionalString(input.href ?? legacy.href ?? legacy.url, 1000);
    const entityType = this.optionalString(input.entityType ?? legacy.entityType, 100);
    const entityId = this.optionalString(input.entityId ?? legacy.entityId, 255);
    const requestedActorId = this.optionalString(input.actorId ?? legacy.actorId, 64);
    const actorId = requestedActorId ? await this.validActorId(requestedActorId, tenantId) : null;
    const body = input.body === null || input.body === undefined
      ? (typeof legacy.body === 'string' ? legacy.body : null)
      : String(input.body).slice(0, 10000);
    const meta = { ...legacy, body, href, actorId, entityType, entityId };
    const key = this.dedupeKey(input, legacy, type, category, entityType, entityId, actorId);

    if (key) {
      const existing = await this.findByKey(tenantId, recipientId, key);
      if (existing) return existing;
    }

    const prefs = await this.getPreferences(recipientId);
    const security = this.isSecurity(category, type);
    const inAppAllowed = this.channelAllowed(
      input.inApp,
      input.forceInApp,
      security,
      prefs.inAppNotifications,
      this.preferenceKeys(type, category, true),
      DEFAULT_IN_APP[category] ?? true,
    );
    const emailAllowed = this.channelAllowed(
      input.email ?? input.sendEmail,
      input.forceEmail,
      security,
      prefs.emailNotifications,
      this.preferenceKeys(type, category, false),
      DEFAULT_EMAIL[category] ?? false,
    );

    if (!inAppAllowed && !emailAllowed) return null;

    let record: NotificationRecord | null = null;
    if (inAppAllowed) {
      const readAt = input.readAt ?? (input.isRead ? new Date() : null);
      const values = {
        tenantId,
        userId: recipientId,
        type,
        category,
        title,
        body,
        href,
        actorId,
        entityType,
        entityId,
        readAt,
        isRead: Boolean(readAt),
        data: meta,
        meta,
        idempotencyKey: key,
        dedupeKey: key,
      };
      const [inserted] = await this.drizzle.db
        .insert(notifications)
        .values(values)
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        record = this.serialize(inserted);
      } else if (key) {
        const existing = await this.findByKey(tenantId, recipientId, key);
        if (existing) return existing;
      }
    }

    if (record) this.emitToSocket(recipientId, record);

    if (emailAllowed && recipient.email) {
      await this.deliverEmail(recipient.email, {
        title,
        body,
        href,
      });
    }

    return record;
  }

  private async findByKey(tenantId: string, userId: string, key: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.audience, 'personal'),
        or(eq(notifications.idempotencyKey, key), eq(notifications.dedupeKey, key)),
      ))
      .limit(1);
    return row ? this.serialize(row) : null;
  }

  private async getPreferences(userId: string) {
    try {
      if (this.preferences) {
        const value = await this.preferences.get(userId);
        return {
          inAppNotifications: this.objectValue(value?.inAppNotifications),
          emailNotifications: this.objectValue(value?.emailNotifications),
        };
      }
    } catch {}
    try {
      const value = await this.drizzle.db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });
      return {
        inAppNotifications: this.objectValue(value?.inAppNotifications),
        emailNotifications: this.objectValue(value?.emailNotifications),
      };
    } catch {
      return { inAppNotifications: {}, emailNotifications: {} };
    }
  }

  private channelAllowed(
    requested: boolean | undefined,
    forced: boolean | undefined,
    security: boolean,
    values: Record<string, unknown>,
    keys: string[],
    fallback: boolean,
  ) {
    if (forced !== undefined) return forced;
    if (requested === false) return false;
    if (security) return true;
    for (const key of keys) {
      if (typeof values[key] === 'boolean') return values[key] as boolean;
    }
    return requested ?? fallback;
  }

  private preferenceKeys(type: string, category: string, inApp: boolean) {
    const keys: string[] = [];
    const normalizedType = type.toLowerCase();
    if (normalizedType === 'like' || normalizedType === 'comment' || normalizedType === 'follow' || normalizedType === 'mention') {
      keys.push(normalizedType === 'follow' ? 'follows' : normalizedType);
    }
    if (category === 'learning') {
      if (normalizedType.includes('certificate')) keys.push('certificates');
      if (normalizedType.includes('completion') || normalizedType.includes('completed')) keys.push('completions');
      keys.push('courseUpdates', 'learning');
    }
    if (category === 'commerce') {
      if (normalizedType.includes('payment')) keys.push('payments');
      keys.push('orders', 'commerce');
    }
    if (category === 'messages') keys.push('directMessages', 'messages', 'mentions');
    if (category === 'security') keys.push('securityAlerts', 'security');
    if (category === 'social') keys.push('social');
    if (inApp) keys.push('inApp');
    else keys.push('email');
    keys.push(category);
    return [...new Set(keys)];
  }

  private categoryFor(category: string | undefined, type: string) {
    if (category) return String(category).trim().slice(0, 50) || 'system';
    const normalized = type.toLowerCase();
    if (['like', 'comment', 'follow', 'mention'].includes(normalized)) return 'social';
    if (['enrollment', 'enrolled', 'course_completed', 'course_completion', 'certificate_issued', 'certificate_reissued', 'certificate_revoked', 'event_registration_confirmed', 'certificate'].includes(normalized)) return 'learning';
    if (['order_created', 'order_confirmed', 'payment_succeeded', 'payment_failed', 'order_expired'].includes(normalized)) return 'commerce';
    if (['dm_message', 'direct_message', 'message'].includes(normalized)) return 'messages';
    if (this.isSecurity('', normalized)) return 'security';
    return 'system';
  }

  private isSecurity(category: string, type: string) {
    return category === 'security' || /(security|password|login|2fa|two.factor|account|email.change|email_changed)/i.test(type);
  }

  private dedupeKey(
    input: NotificationInput,
    legacy: Record<string, unknown>,
    type: string,
    category: string,
    entityType: string | null,
    entityId: string | null,
    actorId: string | null,
  ) {
    const explicit = this.optionalString(
      input.idempotencyKey ?? input.dedupeKey ?? legacy.idempotencyKey ?? legacy.dedupeKey,
      255,
    );
    if (explicit) return explicit;
    if (!entityId) return null;
    const stableTypes = new Set([
      'like', 'comment', 'follow', 'mention', 'enrollment', 'course_completed', 'course_completion',
      'certificate_issued', 'certificate_reissued', 'certificate_revoked', 'order_created', 'order_confirmed', 'payment_succeeded', 'payment_failed', 'order_expired',
    ]);
    if (!stableTypes.has(type)) return null;
    return `${category}:${type}:${entityType ?? ''}:${entityId}:${actorId ?? ''}`.slice(0, 255);
  }

  private async validActorId(actorId: string, tenantId: string) {
    try {
      const actor = await this.drizzle.db.query.users.findFirst({
        where: eq(users.id, actorId),
        columns: { id: true, tenantId: true },
      });
      return actor && String(actor.tenantId) === String(tenantId) ? actor.id : null;
    } catch {
      return null;
    }
  }

  private async deliverEmail(to: string, notification: { title: string; body: string | null; href: string | null }) {
    if (!this.emailService?.isConfigured) return;
    const link = this.absoluteHref(notification.href);
    const safeTitle = this.escapeHtml(notification.title);
    const safeBody = this.escapeHtml(notification.body ?? '');
    const action = link ? `<p><a href="${this.escapeHtml(link)}">Open notification</a></p>` : '';
    try {
      await this.emailService.send({
        to,
        subject: notification.title,
        html: `<div><h1>${safeTitle}</h1>${safeBody ? `<p>${safeBody}</p>` : ''}${action}</div>`,
        text: `${notification.title}${notification.body ? `\n\n${notification.body}` : ''}${link ? `\n\n${link}` : ''}`,
      });
    } catch {}
  }

  private absoluteHref(href: string | null) {
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return href;
    let base = '';
    try {
      base = this.config?.get('FRONTEND_URL') || '';
    } catch {}
    if (!base) return null;
    return `${base.replace(/\/$/, '')}${href.startsWith('/') ? href : `/${href}`}`;
  }

  private emitToSocket(userId: string, notification: NotificationRecord) {
    try {
      this.wsGateway?.sendToUser(userId, 'notification:new', notification);
    } catch {}
  }

  private emitUnreadCount(userId: string, count: number) {
    try {
      this.wsGateway?.sendToUser(userId, 'notification:unread-count', { count });
    } catch {}
  }

  private encodeCursor(notification: NotificationRecord) {
    return Buffer.from(JSON.stringify({
      createdAt: new Date(notification.createdAt).toISOString(),
      id: notification.id,
    })).toString('base64url');
  }

  private decodeCursor(value: string) {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { createdAt?: string; id?: string };
      if (!parsed.createdAt || !parsed.id || Number.isNaN(new Date(parsed.createdAt).getTime())) throw new Error('Invalid cursor');
      return { createdAt: new Date(parsed.createdAt), id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid notification cursor');
    }
  }

  private serialize(row: typeof notifications.$inferSelect): NotificationRecord {
    const meta = this.objectValue(row.meta ?? row.data);
    return {
      ...row,
      isRead: Boolean(row.readAt ?? row.isRead),
      data: meta,
      meta,
    };
  }

  private objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private optionalString(value: unknown, maxLength: number) {
    if (value === null || value === undefined || value === '') return null;
    return String(value).slice(0, maxLength);
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[character] ?? character);
  }
}
