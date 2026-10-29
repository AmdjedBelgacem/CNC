import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../src/database/drizzle.service';
import { courses } from '../src/database/schema/courses';
import { enrollments } from '../src/database/schema/progress';
import { tenants } from '../src/database/schema/tenants';
import { users } from '../src/database/schema/users';
import { liveSessions } from '../src/database/schema/live-sessions';
import { LiveSessionsService } from '../src/modules/courses/live-sessions.service';
import type { LiveSession } from '../src/database/schema/live-sessions';

/**
 * Live sessions: the join gate is the security boundary of the whole feature —
 * the Meet URL is the credential — so these tests exercise every rejection
 * branch (enrollment, time window, tenant scope, lifecycle) plus the save-time
 * Meet URL allowlist. They run against the configured database like the rest of
 * the integration suite and delete every row they create.
 */
describe('live sessions (integration)', () => {
  let drizzle: DrizzleService;
  let svc: LiveSessionsService;
  let tenantId: string;
  let courseId: string;
  let enrolledUserId: string;
  let strangerUserId: string;
  let throwawayTenantId: string;
  const createdSessionIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const actor = { id: '00000000-0000-4000-8000-000000000000', role: 'admin', tenantId: '' };

  const HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    svc = new LiveSessionsService(drizzle, {
      log: () => Promise.resolve(),
    } as never);

    const tenantRows = await drizzle.db.select({ id: tenants.id }).from(tenants).limit(1);
    if (!tenantRows.length) throw new Error('live-sessions spec needs a seeded tenant');
    tenantId = tenantRows[0].id;
    actor.tenantId = tenantId;

    const courseRow = await drizzle.db.query.courses.findFirst({
      where: eq(courses.slug, 'cnc-milling-fundamentals'),
    }) ?? (await drizzle.db.select().from(courses).limit(1))[0];
    if (!courseRow) throw new Error('live-sessions spec needs a seeded course');
    courseId = courseRow.id;

    const userRows = await drizzle.db.select({ id: users.id }).from(users).limit(2);
    if (userRows.length < 2) throw new Error('live-sessions spec needs at least two seeded users');
    enrolledUserId = userRows[0].id;
    strangerUserId = userRows[1].id;
  });

  afterAll(async () => {
    if (createdSessionIds.length) {
      await drizzle.db.delete(liveSessions).where(inArray(liveSessions.id, createdSessionIds));
    }
    if (createdEnrollmentIds.length) {
      await drizzle.db.delete(enrollments).where(inArray(enrollments.id, createdEnrollmentIds));
    }
    if (throwawayTenantId) {
      await drizzle.db.delete(tenants).where(eq(tenants.id, throwawayTenantId));
    }
  });

  async function enroll(userId: string) {
    const existing = await drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
    if (existing) return existing;
    const [row] = await drizzle.db
      .insert(enrollments)
      .values({ userId, courseId, tenantId, status: 'active' })
      .returning();
    createdEnrollmentIds.push(row.id);
    return row;
  }

  async function createSession(overrides: Partial<LiveSession> = {}): Promise<LiveSession> {
    const now = Date.now();
    const [row] = await drizzle.db
      .insert(liveSessions)
      .values({
        tenantId,
        courseId,
        title: 'Spec: join gate session',
        startsAt: new Date(now + 24 * HOUR),
        endsAt: new Date(now + 25 * HOUR),
        timezone: 'UTC',
        meetUrl: 'https://meet.google.com/spec-abc-defg',
        status: 'scheduled',
        ...overrides,
      })
      .returning();
    createdSessionIds.push(row.id);
    return row;
  }

  function joinErrorReason(promise: Promise<unknown>): Promise<string> {
    return promise.then(
      () => 'no-error',
      (error) => (error instanceof ForbiddenException ? (error.getResponse() as any)?.reason ?? 'forbidden' : error.constructor?.name ?? String(error)),
    );
  }

  it('rejects the Meet URL allowlist at save time', async () => {
    for (const bad of ['http://meet.google.com/abc-defg-hij', 'https://evil.example.com/abc', 'https://meet.google.com/abc-defg-hij?steal=1', 'https://zoom.us/j/123', 'not a url']) {
      await expect(svc.create(tenantId, courseId, {
        title: 'Spec: bad url',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + HOUR).toISOString(),
        meetUrl: bad,
      }, actor)).rejects.toThrow(BadRequestException);
    }
    // Valid URL passes the service-level backstop.
    const ok = await svc.create(tenantId, courseId, {
      title: 'Spec: good url',
      startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
      endsAt: new Date(Date.now() + 49 * HOUR).toISOString(),
      meetUrl: 'https://meet.google.com/spec-abc-good',
    }, actor);
    createdSessionIds.push(ok.id);
    expect(ok.meetUrl).toBe('https://meet.google.com/spec-abc-good');
  });

  it('gates join on enrollment: unenrolled users get not_enrolled', async () => {
    const session = await createSession();
    await expect(joinErrorReason(svc.join(tenantId, session.id, { id: strangerUserId, role: 'student', tenantId })))
      .resolves.toBe('not_enrolled');
  });

  it('gates join on the time window: too early and too late both reject', async () => {
    await enroll(enrolledUserId);

    const future = await createSession({ startsAt: new Date(Date.now() + 2 * HOUR), endsAt: new Date(Date.now() + 3 * HOUR) });
    await expect(joinErrorReason(svc.join(tenantId, future.id, { id: enrolledUserId, role: 'student', tenantId })))
      .resolves.toBe('not_started');

    const past = await createSession({
      startsAt: new Date(Date.now() - 3 * HOUR),
      endsAt: new Date(Date.now() - 2 * HOUR),
      status: 'completed',
    });
    await expect(joinErrorReason(svc.join(tenantId, past.id, { id: enrolledUserId, role: 'student', tenantId })))
      .resolves.toBe('ended');
  });

  it('returns the Meet URL only inside the window, computed server-side', async () => {
    await enroll(enrolledUserId);
    // 5 minutes from now: inside the 15-minute early window.
    const soon = await createSession({ startsAt: new Date(Date.now() + 5 * 60_000), endsAt: new Date(Date.now() + 65 * 60_000) });
    const result = await svc.join(tenantId, soon.id, { id: enrolledUserId, role: 'student', tenantId });
    expect(result.meetUrl).toBe(soon.meetUrl);
    expect(result.opensAt.getTime()).toBe(soon.startsAt.getTime() - 15 * 60_000);
    expect(result.closesAt.getTime()).toBe(soon.endsAt.getTime() + 30 * 60_000);
  });

  it('blocks join for cancelled sessions and hides drafts from the learner list', async () => {
    await enroll(enrolledUserId);
    const cancelled = await createSession({ status: 'cancelled' });
    await expect(joinErrorReason(svc.join(tenantId, cancelled.id, { id: enrolledUserId, role: 'student', tenantId })))
      .resolves.toBe('cancelled');

    await createSession({ status: 'draft' });
    const list = await svc.listForLearner(tenantId, courseId, { id: enrolledUserId, role: 'student', tenantId });
    expect(list.enrolled).toBe(true);
    expect(list.sessions.every((s) => s.status !== 'draft')).toBe(true);
    // The one credential must never leak through the list endpoint.
    expect(list.sessions.every((s) => (s as any).meetUrl === undefined)).toBe(true);
  });

  it('scopes everything to the tenant: cross-tenant reads look like missing rows', async () => {
    const [otherTenant] = await drizzle.db
      .insert(tenants)
      .values({ slug: `spec-live-sessions-${Date.now()}`, name: 'Spec: throwaway tenant' })
      .returning();
    throwawayTenantId = otherTenant.id;

    const session = await createSession();
    // Joining with the wrong tenant context must 404, not leak the row.
    await expect(svc.join(otherTenant.id, session.id, { id: enrolledUserId, role: 'student', tenantId: otherTenant.id }))
      .rejects.toThrow(NotFoundException);
    await expect(svc.listForAdmin(otherTenant.id, courseId)).rejects.toThrow(NotFoundException);
    await expect(svc.create(otherTenant.id, courseId, {
      title: 'Spec: cross tenant',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + HOUR).toISOString(),
    }, { ...actor, tenantId: otherTenant.id })).rejects.toThrow(NotFoundException);
  });

  it('publish requires a Meet URL and cancel blocks joining', async () => {
    const noUrl = await createSession({ status: 'draft', meetUrl: null });
    await expect(svc.publish(tenantId, noUrl.id, actor)).rejects.toThrow(BadRequestException);

    const session = await createSession({ status: 'draft' });
    const published = await svc.publish(tenantId, session.id, actor);
    expect(published.status).toBe('scheduled');
    const cancelled = await svc.cancel(tenantId, session.id, actor);
    expect(cancelled.status).toBe('cancelled');
    await expect(joinErrorReason(svc.join(tenantId, session.id, { id: enrolledUserId, role: 'student', tenantId })))
      .resolves.toBe('cancelled');
  });

  it('soft-warns on overlapping sessions in the same course', async () => {
    const now = Date.now();
    const created = await svc.create(tenantId, courseId, {
      title: 'Spec: overlap probe',
      startsAt: new Date(now + 24 * HOUR).toISOString(),
      endsAt: new Date(now + 25 * HOUR).toISOString(),
      meetUrl: 'https://meet.google.com/spec-abc-overlap',
    }, actor);
    createdSessionIds.push(created.id);
    // The fixed session created at the top of the suite starts in 24h for 1h — overlap expected.
    expect(created.warnings.length).toBeGreaterThan(0);
  });
});
