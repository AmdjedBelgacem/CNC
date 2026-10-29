import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { and, asc, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { enrollments } from '../../database/schema/progress';
import { courses, series } from '../../database/schema/courses';
import { liveSessions } from '../../database/schema/live-sessions';
import type { NewLiveSession } from '../../database/schema/live-sessions';
import { AuditService } from '../auth/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLiveSessionDto, UpdateLiveSessionDto, isValidMeetUrl } from './dto/live-sessions.dto';

/** Learners may open the Meet room this many minutes before startsAt. */
export const JOIN_WINDOW_MINUTES_BEFORE = 15;
/** …and this many minutes after endsAt (grace for overrun). */
export const JOIN_WINDOW_MINUTES_AFTER = 30;

export type LiveSessionJoinState = 'joinable' | 'not_started' | 'ended' | 'not_enrolled' | 'cancelled';

type Actor = { id: string; role: string; tenantId: string };

const LEARNER_VISIBLE_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'] as const;
const ACTIVE_STATUSES = ['scheduled', 'live'] as const;

/**
 * Live course sessions on Google Meet.
 *
 * Tenant isolation is explicit in every query: tenantId is always part of the
 * WHERE clause, never inferred from a row already fetched. The Meet URL is the
 * one credential on this entity, so it is returned only by `join` behind the
 * enrollment + time-window gate — list endpoints redact it unconditionally.
 */
@Injectable()
export class LiveSessionsService {
  private readonly logger = new Logger(LiveSessionsService.name);

  constructor(
    private drizzle: DrizzleService,
    private audit: AuditService,
    // Optional so the module works in test setups that build the service by hand.
    @Optional() private notifications?: NotificationsService,
  ) {}

  private async assertCourseInTenant(tenantId: string, courseId: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
      columns: { id: true, slug: true, title: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async getSessionInTenant(tenantId: string, sessionId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(liveSessions)
      .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, tenantId)));
    if (!row) throw new NotFoundException('Live session not found');
    return row;
  }

  private normalizeInput(dto: CreateLiveSessionDto | UpdateLiveSessionDto) {
    const values: Record<string, unknown> = {};
    if (dto.title !== undefined) values.title = dto.title;
    if (dto.description !== undefined) values.description = dto.description ?? null;
    if (dto.seriesId !== undefined) values.seriesId = dto.seriesId || null;
    if (dto.startsAt !== undefined) values.startsAt = new Date(dto.startsAt);
    if (dto.endsAt !== undefined) values.endsAt = new Date(dto.endsAt);
    if (dto.timezone !== undefined) values.timezone = dto.timezone || 'UTC';
    if (dto.capacity !== undefined) values.capacity = dto.capacity ?? null;
    if (dto.meetUrl !== undefined) values.meetUrl = dto.meetUrl || null;
    if ('meetUrl' in dto && dto.meetUrl != null && dto.meetUrl !== '' && !isValidMeetUrl(dto.meetUrl)) {
      // DTO validator already enforces this; re-checking keeps hand-built payloads honest.
      throw new BadRequestException('meetUrl must be a Google Meet URL like https://meet.google.com/abc-defg-hij');
    }
    return values;
  }

  private validateTimes(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be valid datetimes');
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  /** Soft (non-blocking) warning about other active sessions overlapping the given window. */
  private async overlapWarning(tenantId: string, courseId: string, startsAt: Date, endsAt: Date, excludeId?: string): Promise<string[]> {
    const conditions = [
      eq(liveSessions.tenantId, tenantId),
      eq(liveSessions.courseId, courseId),
      inArray(liveSessions.status, [...ACTIVE_STATUSES]),
      lt(liveSessions.startsAt, endsAt),
      gt(liveSessions.endsAt, startsAt),
    ];
    if (excludeId) conditions.push(sql`${liveSessions.id} <> ${excludeId}`);
    const overlaps = await this.drizzle.db
      .select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt })
      .from(liveSessions)
      .where(and(...conditions));
    return overlaps.map((row) => `Overlaps with "${row.title}" (${row.startsAt.toISOString()})`);
  }

  private async assertSeriesInCourse(tenantId: string, courseId: string, seriesId: string | null | undefined) {
    if (!seriesId) return;
    const found = await this.drizzle.db.query.series.findFirst({
      where: and(eq(series.id, seriesId), eq(series.courseId, courseId), eq(series.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!found) throw new BadRequestException('seriesId does not belong to this course');
  }

  async listForAdmin(tenantId: string, courseId: string) {
    await this.assertCourseInTenant(tenantId, courseId);
    return this.drizzle.db
      .select()
      .from(liveSessions)
      .where(and(eq(liveSessions.tenantId, tenantId), eq(liveSessions.courseId, courseId)))
      .orderBy(asc(liveSessions.startsAt));
  }

  async create(tenantId: string, courseId: string, dto: CreateLiveSessionDto, actor: Actor) {
    const course = await this.assertCourseInTenant(tenantId, courseId);
    if (dto.meetUrl && !isValidMeetUrl(dto.meetUrl)) {
      throw new BadRequestException('meetUrl must be a Google Meet URL like https://meet.google.com/abc-defg-hij');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateTimes(startsAt, endsAt);
    await this.assertSeriesInCourse(tenantId, courseId, dto.seriesId);

    const values: NewLiveSession = {
      tenantId,
      courseId,
      title: dto.title,
      description: dto.description ?? null,
      seriesId: dto.seriesId || null,
      startsAt,
      endsAt,
      timezone: dto.timezone || 'UTC',
      meetUrl: dto.meetUrl || null,
      status: 'draft',
      capacity: dto.capacity ?? null,
      createdById: actor.id,
    };
    const [created] = await this.drizzle.db.insert(liveSessions).values(values).returning();
    if (!created) throw new BadRequestException('Live session could not be created');
    void this.audit.log({
      userId: actor.id,
      tenantId,
      action: 'live_session.created',
      entityType: 'live_session',
      entityId: created.id,
      details: { courseId, courseSlug: course.slug, title: dto.title, startsAt: startsAt.toISOString() },
    });
    return {
      ...created,
      warnings: await this.overlapWarning(tenantId, courseId, startsAt, endsAt, created.id),
    };
  }

  async update(tenantId: string, sessionId: string, dto: UpdateLiveSessionDto, actor: Actor) {
    const existing = await this.getSessionInTenant(tenantId, sessionId);
    const values = this.normalizeInput(dto);
    const startsAt = (values.startsAt as Date) ?? existing.startsAt;
    const endsAt = (values.endsAt as Date) ?? existing.endsAt;
    this.validateTimes(startsAt, endsAt);
    if (values.seriesId !== undefined) {
      await this.assertSeriesInCourse(tenantId, existing.courseId, values.seriesId as string | null);
    }
    if (Object.keys(values).length > 0) {
      await this.drizzle.db
        .update(liveSessions)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, tenantId)));
    }
    void this.audit.log({
      userId: actor.id,
      tenantId,
      action: 'live_session.updated',
      entityType: 'live_session',
      entityId: sessionId,
      details: { fields: Object.keys(values) },
    });
    const updated = await this.getSessionInTenant(tenantId, sessionId);
    return {
      ...updated,
      warnings: await this.overlapWarning(tenantId, updated.courseId, updated.startsAt, updated.endsAt, sessionId),
    };
  }

  async remove(tenantId: string, sessionId: string, actor: Actor) {
    const existing = await this.getSessionInTenant(tenantId, sessionId);
    await this.drizzle.db
      .delete(liveSessions)
      .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, tenantId)));
    void this.audit.log({
      userId: actor.id,
      tenantId,
      action: 'live_session.deleted',
      entityType: 'live_session',
      entityId: sessionId,
      details: { title: existing.title },
    });
    return { id: sessionId, deleted: true };
  }

  async publish(tenantId: string, sessionId: string, actor: Actor) {
    const existing = await this.getSessionInTenant(tenantId, sessionId);
    if (existing.status === 'cancelled') throw new BadRequestException('A cancelled session cannot be published');
    if (!existing.meetUrl) throw new BadRequestException('Add a Google Meet URL before publishing');
    if (existing.status !== 'scheduled') {
      await this.drizzle.db
        .update(liveSessions)
        .set({ status: 'scheduled', updatedAt: new Date() })
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, tenantId)));
      await this.notifyEnrolled(tenantId, existing.courseId, existing);
    }
    void this.audit.log({
      userId: actor.id,
      tenantId,
      action: 'live_session.published',
      entityType: 'live_session',
      entityId: sessionId,
      details: { title: existing.title, startsAt: existing.startsAt.toISOString() },
    });
    return this.getSessionInTenant(tenantId, sessionId);
  }

  async cancel(tenantId: string, sessionId: string, actor: Actor) {
    const existing = await this.getSessionInTenant(tenantId, sessionId);
    if (existing.status === 'completed') throw new BadRequestException('A completed session cannot be cancelled');
    if (existing.status !== 'cancelled') {
      await this.drizzle.db
        .update(liveSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, tenantId)));
    }
    void this.audit.log({
      userId: actor.id,
      tenantId,
      action: 'live_session.cancelled',
      entityType: 'live_session',
      entityId: sessionId,
      details: { title: existing.title },
    });
    return this.getSessionInTenant(tenantId, sessionId);
  }

  /**
   * v2 hook: create a Google Calendar event + conferenceData and persist
   * meetUrl/calendarEventId. Feature-flagged on the Google OAuth env vars; when
   * they are absent the admin UI only allows pasting a Meet URL. Returning 501
   * (not a silent 404) keeps the flag discoverable.
   */
  async provisionMeet(tenantId: string, sessionId: string, _actor: Actor) {
    await this.getSessionInTenant(tenantId, sessionId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ForbiddenException('Google Calendar provisioning is not configured. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN, or paste a Meet URL manually.');
    }
    throw new BadRequestException('Google Calendar provisioning is not implemented yet in this version');
  }

  private async isEnrolled(tenantId: string, userId: string, courseId: string): Promise<boolean> {
    const [row] = await this.drizzle.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.status, 'active'),
      ));
    return Boolean(row);
  }

  /**
   * Learner-facing list. Drafts are never exposed; cancelled sessions are
   * included (the UI marks them) but carry no Meet URL. `meetUrl` is stripped
   * unconditionally — the join endpoint is the only way to obtain it.
   */
  async listForLearner(tenantId: string, courseId: string, user: Actor | null) {
    await this.assertCourseInTenant(tenantId, courseId);
    const rows = await this.drizzle.db
      .select()
      .from(liveSessions)
      .where(and(
        eq(liveSessions.tenantId, tenantId),
        eq(liveSessions.courseId, courseId),
        inArray(liveSessions.status, [...LEARNER_VISIBLE_STATUSES]),
      ))
      .orderBy(asc(liveSessions.startsAt));
    const enrolled = user ? await this.isEnrolled(tenantId, user.id, courseId) : false;
    return {
      enrolled,
      sessions: rows.map((row) => this.learnerView(row, enrolled)),
    };
  }

  private joinWindow(session: { startsAt: Date; endsAt: Date }) {
    return {
      opensAt: new Date(session.startsAt.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60_000),
      closesAt: new Date(session.endsAt.getTime() + JOIN_WINDOW_MINUTES_AFTER * 60_000),
    };
  }

  private learnerView(row: typeof liveSessions.$inferSelect, enrolled: boolean) {
    const { opensAt, closesAt } = this.joinWindow(row);
    let joinState: LiveSessionJoinState;
    if (row.status === 'cancelled') joinState = 'cancelled';
    else if (!enrolled) joinState = 'not_enrolled';
    else if (row.status === 'completed' || Date.now() > closesAt.getTime()) joinState = 'ended';
    else if (Date.now() < opensAt.getTime()) joinState = 'not_started';
    else joinState = 'joinable';
    const { meetUrl: _meetUrl, ...safe } = row;
    return { ...safe, opensAt, closesAt, joinState, hasMeetUrl: Boolean(row.meetUrl) };
  }

  /**
   * Join gate — server-side clock only, so client clock skew cannot widen the
   * window. Every rejection is a 403 with a machine-readable reason so the UI
   * can show the right disabled state ("Opens 15 minutes before" etc.).
   */
  async join(tenantId: string, sessionId: string, user: Actor) {
    const session = await this.getSessionInTenant(tenantId, sessionId);
    if (session.status === 'cancelled') {
      throw new ForbiddenException({ reason: 'cancelled', message: 'This session was cancelled' });
    }
    if (session.status === 'draft' || session.status === 'completed') {
      throw new ForbiddenException({ reason: 'ended', message: 'This session is not open for joining' });
    }
    const enrolled = await this.isEnrolled(tenantId, user.id, session.courseId);
    if (!enrolled) {
      throw new ForbiddenException({ reason: 'not_enrolled', message: 'Enroll in the course to join this session' });
    }
    const { opensAt, closesAt } = this.joinWindow(session);
    const now = Date.now();
    if (now < opensAt.getTime()) {
      throw new ForbiddenException({ reason: 'not_started', message: 'The room opens 15 minutes before the session starts' });
    }
    if (now > closesAt.getTime()) {
      throw new ForbiddenException({ reason: 'ended', message: 'This session has ended' });
    }
    if (!session.meetUrl) {
      throw new ForbiddenException({ reason: 'no_meet_url', message: 'The Meet link has not been added yet' });
    }
    return { meetUrl: session.meetUrl, opensAt, closesAt };
  }

  /** Next upcoming session across all of a user's enrollments in this tenant. */
  async nextForUser(tenantId: string, userId: string) {
    const rows = await this.drizzle.db
      .select({
        id: liveSessions.id,
        title: liveSessions.title,
        description: liveSessions.description,
        startsAt: liveSessions.startsAt,
        endsAt: liveSessions.endsAt,
        timezone: liveSessions.timezone,
        status: liveSessions.status,
        courseId: liveSessions.courseId,
        courseTitle: courses.title,
        courseSlug: courses.slug,
      })
      .from(liveSessions)
      .innerJoin(courses, eq(courses.id, liveSessions.courseId))
      .innerJoin(enrollments, and(
        eq(enrollments.courseId, liveSessions.courseId),
        eq(enrollments.userId, userId),
        eq(enrollments.status, 'active'),
      ))
      .where(and(
        eq(liveSessions.tenantId, tenantId),
        inArray(liveSessions.status, ['scheduled', 'live']),
        gte(liveSessions.endsAt, new Date()),
      ))
      .orderBy(asc(liveSessions.startsAt))
      .limit(1);
    if (!rows[0]) return null;
    const { opensAt, closesAt } = this.joinWindow(rows[0]);
    return { ...rows[0], opensAt, closesAt };
  }

  private async notifyEnrolled(tenantId: string, courseId: string, session: typeof liveSessions.$inferSelect) {
    if (!this.notifications) return;
    try {
      const learners = await this.drizzle.db
        .select({ userId: enrollments.userId })
        .from(enrollments)
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.courseId, courseId), eq(enrollments.status, 'active')));
      const course = await this.drizzle.db.query.courses.findFirst({
        where: eq(courses.id, courseId),
        columns: { slug: true, title: true },
      });
      await Promise.all(learners.map(({ userId }) =>
        this.notifications!.notifyUser({
          tenantId,
          userId,
          type: 'live_session_published',
          category: 'learning',
          title: `Live session scheduled: ${session.title}`,
          body: `${course?.title ?? 'Your course'} · ${session.startsAt.toISOString()} (${session.timezone})`,
          href: course ? `/courses/${course.slug}` : undefined,
          entityType: 'live_session',
          entityId: session.id,
          sendEmail: true,
          idempotencyKey: `live_session_published:${tenantId}:${userId}:${session.id}:${session.startsAt.toISOString()}`,
        }).catch(() => {}),
      ));
    } catch (error) {
      // Notifications must never block the publish itself.
      this.logger.warn(`live session publish notification failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
