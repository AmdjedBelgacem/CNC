import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { events, eventAttendees } from '../../database/schema/events';
import { eq, and, asc, count, sql } from 'drizzle-orm';

@Injectable()
export class EventsService {
  constructor(private drizzle: DrizzleService) {}

  async findByTenant(tenantId: string, opts?: {
    type?: string; upcoming?: boolean; page?: number; limit?: number;
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

    return {
      data: data.map((e: any) => ({
        ...e,
        registeredCount: (e.attendees || []).filter((a: any) => a.status === 'registered').length,
        attendees: undefined,
      })),
      total: totalArr[0]?.count || 0,
      page,
      limit,
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

  async findById(id: string) {
    const event = await this.drizzle.db.query.events.findFirst({
      where: eq(events.id, id),
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async register(eventId: string, userId: string) {
    const event = await this.findById(eventId);
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
    return registration;
  }

  async cancelRegistration(eventId: string, userId: string) {
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
    return event;
  }

  async getUpcoming(tenantId: string, limit = 3) {
    const result = await this.findByTenant(tenantId, { upcoming: true, limit });
    return result.data;
  }
}
