import { localizeEventFields, resolveContentLocale } from '../courses/lesson-content';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { events, eventAttendees } from '../../database/schema/events';
import { eq, and, asc, count, sql } from 'drizzle-orm';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(
    private drizzle: DrizzleService,
    private search?: SearchService,
    private notifications?: NotificationsService,
  ) {}

  private syncSearch(tenantId: string, id: string) {
    void this.search?.indexEntity(tenantId, 'event', id);
  }

  /**
   * Published events for the tenant, localized.
   *
   * `opts.localeInput` is the request (or an explicit locale string), so the list
   * and a single event resolve their copy the same way.
   */
  async findByTenant(tenantId: string, opts?: {
    type?: string; upcoming?: boolean; page?: number; limit?: number; localeInput?: unknown;
  }) {
    const conditions: any[] = [eq(events.tenantId, tenantId), eq(events.isPublished, true)];
    if (opts?.type) conditions.push(eq(events.eventType, opts.type));
    if (opts?.upcoming) conditions.push(sql`${events.startDate} >= NOW()`);

    const page = opts?.page || 1;
    const limit = opts?.limit || 20;

    const data = await this.drizzle.db.query.events.findMany({
      where: and(...conditions),
      orderBy: [asc(events.startDate)],
      limit,
      offset: (page - 1) * limit,
      with: {
        attendees: { columns: { id: true, userId: true, status: true } },
      },
    });

    const totalArr = await this.drizzle.db
      .select({ count: count() })
      .from(events)
      .where(and(...conditions));

    const locale = resolveContentLocale(opts?.localeInput);
    return {
      data: data.map((e: any) => ({
        ...localizeEventFields(e, locale).value,
        registeredCount: (e.attendees || []).filter((a: any) => a.status === 'registered').length,
        attendees: undefined,
      })),
      total: totalArr[0]?.count || 0,
      page,
      limit,
      locale,
    };
  }

  async findBySlug(tenantId: string, slug: string, currentUserId?: string) {
    const event = await this.drizzle.db.query.events.findFirst({
      where: and(eq(events.tenantId, tenantId), eq(events.slug, slug)),
      with: {
        attendees: {
          columns: { id: true, userId: true, status: true, registeredAt: true },
        },
      },
    }) as any;
    if (!event) throw new NotFoundException('Event not found');

    const attendees = event.attendees || [];
    const userRegistration = currentUserId
      ? attendees.find((a: any) => a.userId === currentUserId)
      : null;

    return {
      ...event,
      registeredCount: attendees.filter((a: any) => a.status === 'registered').length,
      userRegistration: userRegistration || null,
      isFull: event.maxAttendees ? attendees.filter((a: any) => a.status === 'registered').length >= event.maxAttendees : false,
      attendees: undefined,
    };
  }

  async findById(id: string, tenantId?: string, localeInput?: unknown) {
    const event = await this.drizzle.db.query.events.findFirst({
      where: tenantId ? and(eq(events.id, id), eq(events.tenantId, tenantId)) : eq(events.id, id),
    });
    if (!event) throw new NotFoundException('Event not found');
    // The admin read path passes no locale and keeps the raw row.
    if (localeInput === undefined) return event;
    return localizeEventFields(event as unknown as Record<string, any>, resolveContentLocale(localeInput)).value;
  }

  async register(eventId: string, userId: string, tenantId: string) {
    const event = await this.findById(eventId, tenantId);
    if (!event.isPublished) throw new BadRequestException('Event is not published');

    const existing = await this.drizzle.db.query.eventAttendees.findFirst({
      where: and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)),
    });
    if (existing) throw new ConflictException('Already registered');

    if (event.maxAttendees) {
      const [registrationCount] = await this.drizzle.db
        .select({ count: count() })
        .from(eventAttendees)
        .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.status, 'registered')));
      if ((registrationCount?.count ?? 0) >= event.maxAttendees) {
        throw new BadRequestException('Event is full');
      }
    }

    const [registration] = await this.drizzle.db.insert(eventAttendees)
      .values({ eventId, userId })
      .returning();
    void this.notifications?.notifyUser({
      tenantId,
      userId,
      type: 'event_registration_confirmed',
      category: 'learning',
      title: 'Event registration confirmed',
      body: `You are registered for ${event.title}.`,
      href: `/events/${event.slug}`,
      entityType: 'event',
      entityId: event.id,
      idempotencyKey: `event-registration:${tenantId}:${event.id}:${userId}`,
    }).catch(() => {});
    return registration;
  }

  async cancelRegistration(eventId: string, userId: string, tenantId: string) {
    await this.findById(eventId, tenantId);
    const existing = await this.drizzle.db.query.eventAttendees.findFirst({
      where: and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Registration not found');

    await this.drizzle.db.delete(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, userId)));
    return { cancelled: true };
  }

  async create(data: any) {
    const [event] = await this.drizzle.db.insert(events).values(data).returning();
    if (event) this.syncSearch(event.tenantId, event.id);
    return event;
  }

  async update(id: string, data: any, tenantId?: string) {
    const where = tenantId
      ? and(eq(events.id, id), eq(events.tenantId, tenantId))
      : eq(events.id, id);
    const [event] = await this.drizzle.db
      .update(events).set({ ...data, updatedAt: new Date() })
      .where(where).returning();
    if (!event) throw new NotFoundException('Event not found');
    this.syncSearch(event.tenantId, event.id);
    return event;
  }

  async getUpcoming(tenantId: string, limit = 3) {
    const result = await this.findByTenant(tenantId, { upcoming: true, limit });
    return result.data;
  }
}
