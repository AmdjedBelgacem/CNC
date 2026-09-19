import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users } from '../../database/schema/users';
import { courses } from '../../database/schema/courses';
import { posts } from '../../database/schema/posts';
import { events } from '../../database/schema/events';
import { orders } from '../../database/schema/orders';
import { sponsors } from '../../database/schema/sponsors';
import { tenants } from '../../database/schema/tenants';
import { enrollments, lessonProgress } from '../../database/schema';
import { certifications } from '../../database/schema/certifications';
import { eq, count, sql, desc, and, gte, lt, lte, or, ilike } from 'drizzle-orm';

@Injectable()
export class AdminService {
  constructor(private drizzle: DrizzleService) {}

  private sanitizeUser(user: any) {
    const { passwordHash, passwordChangedAt, failedLoginAttempts, deletedByUserId, ...safe } = user;
    const tenantRoles = user.tenantRoles?.map((r: any) => ({
      tenantId: r.tenantId,
      tenantSlug: r.tenant?.slug || '',
      role: r.role,
    })) || [];
    return {
      ...safe,
      tenantRoles,
    };
  }

  private rangeFromParam(range?: string): { since: Date; trunc: string; bucket: string } {
    const now = new Date();
    switch (range) {
      case '7d':
        return { since: new Date(now.getTime() - 7 * 864e5), trunc: 'day', bucket: 'day' };
      case '90d':
        return { since: new Date(now.getTime() - 90 * 864e5), trunc: 'day', bucket: 'day' };
      case '12m':
        return { since: new Date(now.getTime() - 365 * 864e5), trunc: 'month', bucket: 'month' };
      case '30d':
      default:
        return { since: new Date(now.getTime() - 30 * 864e5), trunc: 'day', bucket: 'day' };
    }
  }

  private buildSearchCondition(search?: string) {
    if (!search) return undefined;
    const pattern = `%${search}%`;
    return or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(sql`COALESCE(${users.username}, '')`, pattern)
    );
  }

  // ---- S1: hardened base stats + efficient aggregations with Redis cache ----

  async getStats(tenantId: string) {
    const [userCount, courseCount, postCount, eventCount, orderCount] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(users).where(eq(users.tenantId, tenantId)).then((r) => r[0]),
      this.drizzle.db.select({ count: count() }).from(courses).where(eq(courses.tenantId, tenantId)).then((r) => r[0]),
      this.drizzle.db
        .select({ count: count() })
        .from(posts)
        .where(eq((posts as any).tenantId, tenantId))
        .then((r) => r[0])
        .catch(() => ({ count: 0 } as any)),
      this.drizzle.db.select({ count: count() }).from(events).where(eq(events.tenantId, tenantId)).then((r) => r[0]),
      this.drizzle.db.select({ count: count() }).from(orders).where(eq(orders.tenantId, tenantId)).then((r) => r[0]),
    ]);

    const revenueResult = await this.drizzle.db
      .select({ total: sql<number>`COALESCE(SUM(total), 0)` })
      .from(orders)
      .where(sql`${orders.tenantId} = ${tenantId} AND ${orders.status} = 'confirmed'`);

    const recentUsers = await this.drizzle.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      orderBy: [desc(users.createdAt)],
      limit: 5,
      columns: { id: true, name: true, email: true, createdAt: true },
    });

    return {
      users: userCount?.count || 0,
      courses: courseCount?.count || 0,
      posts: postCount?.count || 0,
      events: eventCount?.count || 0,
      orders: orderCount?.count || 0,
      revenue: revenueResult?.[0]?.total || 0,
      recentUsers,
    };
  }

  // --- helpers for bucket generation and sparkline filling ---
  private buildBuckets(since: Date, trunc: string, now: Date = new Date()): Date[] {
    const buckets: Date[] = [];
    const cur = new Date(since);
    // normalize to bucket start
    if (trunc === 'month') {
      cur.setDate(1);
      cur.setHours(0, 0, 0, 0);
      while (cur <= now) {
        buckets.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      cur.setHours(0, 0, 0, 0);
      while (cur <= now) {
        buckets.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return buckets;
  }

  private fillSparkline(
    rows: { bucket: string | Date; count?: number; cents?: number; n?: number }[],
    buckets: Date[],
    valueKey: 'count' | 'cents' | 'n' = 'count',
  ): number[] {
    const map = new Map<string, number>();
    for (const r of rows) {
      const iso = r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket);
      const bucketKey = iso.slice(0, 10);
      const monthKey = iso.slice(0, 7);
      // store both for lookup
      const v = Number((r as any)[valueKey] ?? 0);
      map.set(bucketKey, v);
      map.set(monthKey, v);
    }
    return buckets.map((d) => {
      const dayKey = d.toISOString().slice(0, 10);
      const monthKey = d.toISOString().slice(0, 7);
      return map.get(dayKey) ?? map.get(monthKey) ?? 0;
    });
  }

  async getOverview(tenantId: string, range: string) {
    const { since, trunc } = this.rangeFromParam(range);
    const now = new Date();
    const durationMs = now.getTime() - since.getTime();
    const prevSince = new Date(since.getTime() - durationMs);
    const buckets = this.buildBuckets(since, trunc, now);

    const delta = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? null : 100) : Number((((cur - prev) / prev) * 100).toFixed(1)));

    // Parallel fetches for current and previous period
    const [
      totalUsers,
      totalUsersPrev,
      signupsRows,
      signupsPrevRows,
      activeRows,
      activePrevRows,
      enrollmentsRows,
      enrollmentsPrevRows,
      revenueRows,
      revenuePrevRows,
      completedRows,
      completedPrevRows,
      publishedCourses,
      upcomingEvents,
    ] = await Promise.all([
      this.drizzle.db.select({ n: count() }).from(users).where(eq(users.tenantId, tenantId)).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.select({ n: count() }).from(users).where(and(eq(users.tenantId, tenantId), lt(users.createdAt, since))).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT date_trunc(${sql.raw(`'${trunc}'`)}, created_at) AS bucket, COUNT(*)::int AS count FROM users WHERE tenant_id = ${tenantId} AND created_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any).then((r: any) => (Array.isArray(r) ? r : r.rows ?? [])).catch(() => []),
      this.drizzle.db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE tenant_id = ${tenantId} AND created_at >= ${prevSince.toISOString()}::timestamptz AND created_at < ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? rows[0]?.count ?? 0); }).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT date_trunc(${sql.raw(`'${trunc}'`)}, completed_at) AS bucket, COUNT(DISTINCT user_id)::int AS count FROM lesson_progress WHERE tenant_id = ${tenantId} AND completed_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any).then((r: any) => (Array.isArray(r) ? r : r.rows ?? [])).catch(() => []),
      this.drizzle.db.execute(sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM lesson_progress WHERE tenant_id = ${tenantId} AND completed_at >= ${prevSince.toISOString()}::timestamptz AND completed_at < ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? rows[0]?.count ?? 0); }).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT date_trunc(${sql.raw(`'${trunc}'`)}, started_at) AS bucket, COUNT(*)::int AS count FROM enrollments WHERE tenant_id = ${tenantId} AND started_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any).then((r: any) => (Array.isArray(r) ? r : r.rows ?? [])).catch(() => []),
      this.drizzle.db.execute(sql`SELECT COUNT(*)::int AS n FROM enrollments WHERE tenant_id = ${tenantId} AND started_at >= ${prevSince.toISOString()}::timestamptz AND started_at < ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? rows[0]?.count ?? 0); }).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT date_trunc(${sql.raw(`'${trunc}'`)}, created_at) AS bucket, COALESCE(SUM(total),0)::int AS cents FROM orders WHERE tenant_id = ${tenantId} AND status = 'confirmed' AND created_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any).then((r: any) => (Array.isArray(r) ? r : r.rows ?? [])).catch(() => []),
      this.drizzle.db.execute(sql`SELECT COALESCE(SUM(total),0)::int AS cents FROM orders WHERE tenant_id = ${tenantId} AND status = 'confirmed' AND created_at >= ${prevSince.toISOString()}::timestamptz AND created_at < ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.cents ?? 0); }).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT COUNT(*)::int AS n FROM enrollments WHERE tenant_id = ${tenantId} AND status = 'completed' AND started_at >= ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? rows[0]?.count ?? 0); }).catch(() => 0),
      this.drizzle.db.execute(sql`SELECT COUNT(*)::int AS n FROM enrollments WHERE tenant_id = ${tenantId} AND status = 'completed' AND started_at >= ${prevSince.toISOString()}::timestamptz AND started_at < ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? rows[0]?.count ?? 0); }).catch(() => 0),
      this.drizzle.db.select({ n: count() }).from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.isPublished, true))).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.select({ n: count() }).from(events).where(and(eq(events.tenantId, tenantId), sql`${events.startDate} >= NOW()`)).then((r) => r[0]?.n ?? 0).catch(() => 0),
    ]);

    // Aggregates for current period
    const signupsCurrent = (signupsRows as any[]).reduce((s: number, r: any) => s + Number(r.count ?? 0), 0);
    const signupsPrev = signupsPrevRows as unknown as number;
    const activeCurrent = (activeRows as any[]).reduce((s: number, r: any) => s + Number(r.count ?? 0), 0);
    // active distinct total in range is sum distinct per bucket is not accurate, so also fetch distinct total
    const activeDistinctCurrent = await this.drizzle.db.execute(sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM lesson_progress WHERE tenant_id = ${tenantId} AND completed_at >= ${since.toISOString()}::timestamptz` as any).then((r: any) => { const rows = Array.isArray(r) ? r : r.rows ?? []; return Number(rows[0]?.n ?? 0); }).catch(() => activeCurrent);
    const enrollmentsCurrent = (enrollmentsRows as any[]).reduce((s: number, r: any) => s + Number(r.count ?? 0), 0);
    const enrollmentsPrev = enrollmentsPrevRows as unknown as number;
    const revenueCurrent = (revenueRows as any[]).reduce((s: number, r: any) => s + Number(r.cents ?? 0), 0);
    const revenuePrev = revenuePrevRows as unknown as number;
    const completedCurrent = completedRows as unknown as number;
    const completedPrev = completedPrevRows as unknown as number;

    // Sparklines
    const signupsSparkline = this.fillSparkline(signupsRows as any[], buckets, 'count');
    const activeSparkline = this.fillSparkline(activeRows as any[], buckets, 'count');
    const enrollmentsSparkline = this.fillSparkline(enrollmentsRows as any[], buckets, 'count');
    const revenueSparkline = this.fillSparkline(revenueRows as any[], buckets, 'cents').map((v) => Math.round(v / 100));

    const totalUsersDelta = delta(totalUsers, totalUsersPrev);
    const conversionCurrent = enrollmentsCurrent > 0 ? Number(((completedCurrent / enrollmentsCurrent) * 100).toFixed(1)) : 0;
    const conversionPrev = (enrollmentsPrev as number) > 0 ? Number(((completedPrev as number) / (enrollmentsPrev as number)) * 100) : 0;
    const conversionDelta = enrollmentsCurrent > 0 || (enrollmentsPrev as number) > 0 ? delta(conversionCurrent, conversionPrev) : null;

    const updatedAt = new Date().toISOString();

    return {
      range,
      compare: 'prev' as const,
      updatedAt,
      // backwards compat
      users: { value: totalUsers, delta: totalUsersDelta, sparkline: signupsSparkline },
      activeUsers: { value: activeDistinctCurrent, delta: delta(activeDistinctCurrent, activePrevRows as unknown as number), sparkline: activeSparkline },
      enrollments: { value: enrollmentsCurrent, delta: delta(enrollmentsCurrent, enrollmentsPrev as unknown as number), sparkline: enrollmentsSparkline },
      revenue: { cents: revenueCurrent, delta: delta(revenueCurrent, revenuePrev), sparkline: revenueSparkline },
      coursesPublished: publishedCourses,
      upcomingEvents,
      // new explicit
      signups: { value: signupsCurrent, delta: delta(signupsCurrent, signupsPrev as unknown as number), sparkline: signupsSparkline },
      conversion: { value: conversionCurrent, delta: conversionDelta, sparkline: enrollmentsCurrent > 0 ? this.fillSparkline(await this.getCompletionRateSeries(tenantId, since, trunc, buckets), buckets, 'count') : Array(buckets.length).fill(0) },
    };
  }

  private async getCompletionRateSeries(tenantId: string, since: Date, trunc: string, _buckets: Date[]): Promise<any[]> {
    try {
      const rows: any = await this.drizzle.db.execute(sql`
        SELECT date_trunc(${sql.raw(`'${trunc}'`)}, started_at) AS bucket,
               CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric * 100)::int END AS count
        FROM enrollments WHERE tenant_id = ${tenantId} AND started_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list;
    } catch {
      return [];
    }
  }

  async getSignupsSeries(tenantId: string, range: string) {
    try {
      const { since, trunc } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
        SELECT date_trunc(${sql.raw(`'${trunc}'`)}, created_at) AS bucket, COUNT(*)::int AS count
        FROM users WHERE tenant_id = ${tenantId} AND created_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list.map((r: any) => ({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : String(r.bucket).slice(0, 10), count: Number(r.count) }));
    } catch {
      return [];
    }
  }

  async getActiveUsersSeries(tenantId: string, range: string) {
    try {
      const { since, trunc } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
        SELECT date_trunc(${sql.raw(`'${trunc}'`)}, completed_at) AS bucket, COUNT(DISTINCT user_id)::int AS count
        FROM lesson_progress WHERE tenant_id = ${tenantId} AND completed_at >= ${since.toISOString()}::timestamptz GROUP BY 1 ORDER BY 1` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list.map((r: any) => ({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : String(r.bucket).slice(0, 10), count: Number(r.count) }));
    } catch {
      return [];
    }
  }

  async getTrends(tenantId: string, range: string) {
    const [signups, enrollments, activeUsers, revenue] = await Promise.all([
      this.getSignupsSeries(tenantId, range),
      this.getEnrollmentsSeries(tenantId, range),
      this.getActiveUsersSeries(tenantId, range),
      this.getRevenueSeries(tenantId, range),
    ]);
    return { signups, enrollments, activeUsers, revenue };
  }

  async getEnrollmentsSeries(tenantId: string, range: string) {
    try {
      const { since, trunc } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
      SELECT date_trunc(${sql.raw(`'${trunc}'`)}, started_at) AS bucket, COUNT(*)::int AS count
      FROM enrollments
      WHERE tenant_id = ${tenantId} AND started_at >= ${since.toISOString()}::timestamptz
      GROUP BY 1 ORDER BY 1
    ` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list.map((r: any) => ({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : String(r.bucket).slice(0, 10), count: Number(r.count) }));
    } catch {
      return [];
    }
  }

  async getRevenueSeries(tenantId: string, range: string) {
    try {
      const { since, trunc } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
      SELECT date_trunc(${sql.raw(`'${trunc}'`)}, created_at) AS bucket, COALESCE(SUM(total),0)::int AS cents
      FROM orders
      WHERE tenant_id = ${tenantId} AND status = 'confirmed' AND created_at >= ${since.toISOString()}::timestamptz
      GROUP BY 1 ORDER BY 1
    ` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list.map((r: any) => ({ date: r.bucket instanceof Date ? r.bucket.toISOString().slice(0, 10) : String(r.bucket).slice(0, 10), cents: Number(r.cents) }));
    } catch {
      return [];
    }
  }

  async getTopCourses(tenantId: string, range: string, limit = 8) {
    try {
      const { since } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
      SELECT c.id, c.title, COUNT(e.id)::int AS enrollments
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.tenant_id = ${tenantId} AND e.started_at >= ${since.toISOString()}::timestamptz
      WHERE c.tenant_id = ${tenantId}
      GROUP BY c.id, c.title
      ORDER BY enrollments DESC
      LIMIT ${Number(limit)}
    ` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list as { id: string; title: string; enrollments: number }[];
    } catch {
      return [];
    }
  }

  async getTopCoursesByCompletion(tenantId: string, range: string, limit = 8) {
    try {
      const { since } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
        SELECT c.id, c.title, c.slug,
               COUNT(e.id)::int AS total,
               COUNT(*) FILTER (WHERE e.status = 'completed')::int AS completed,
               CASE WHEN COUNT(e.id) = 0 THEN 0 ELSE ROUND(COUNT(*) FILTER (WHERE e.status = 'completed')::numeric / COUNT(*)::numeric * 100, 1)::float END AS rate
        FROM courses c
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.tenant_id = ${tenantId} AND e.started_at >= ${since.toISOString()}::timestamptz
        WHERE c.tenant_id = ${tenantId}
        GROUP BY c.id, c.title, c.slug
        HAVING COUNT(e.id) > 0
        ORDER BY rate DESC, total DESC
        LIMIT ${Number(limit)}
      ` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list as { id: string; title: string; slug: string; total: number; completed: number; rate: number }[];
    } catch {
      return [];
    }
  }

  async getTopProductsByRevenue(tenantId: string, range: string, limit = 8) {
    try {
      const { since } = this.rangeFromParam(range);
      const rows: any = await this.drizzle.db.execute(sql`
        SELECT p.id, p.title, p.slug, p.thumbnail_url AS "thumbnailUrl",
               SUM(oi.quantity)::int AS units,
               SUM(oi.quantity * oi.price)::int AS "revenueCents"
        FROM products p
        JOIN order_items oi ON oi.product_id = p.id
        JOIN orders o ON o.id = oi.order_id AND o.tenant_id = ${tenantId} AND o.status = 'confirmed' AND o.created_at >= ${since.toISOString()}::timestamptz
        WHERE p.tenant_id = ${tenantId}
        GROUP BY p.id, p.title, p.slug, p.thumbnail_url
        ORDER BY "revenueCents" DESC
        LIMIT ${Number(limit)}
      ` as any);
      const list: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      return list as { id: string; title: string; slug: string; thumbnailUrl: string | null; units: number; revenueCents: number }[];
    } catch {
      return [];
    }
  }

  async getBreakdowns(tenantId: string, range: string, limit = 8) {
    const lim = Math.min(20, Math.max(1, Number(limit) || 8));
    const [byEnrollment, byCompletion, byRevenue] = await Promise.all([
      this.getTopCourses(tenantId, range, lim),
      this.getTopCoursesByCompletion(tenantId, range, lim),
      this.getTopProductsByRevenue(tenantId, range, lim),
    ]);
    return {
      topCoursesByEnrollment: byEnrollment,
      topCoursesByCompletion: byCompletion,
      topProductsByRevenue: byRevenue,
      updatedAt: new Date().toISOString(),
      range,
    };
  }

  async getInsights(tenantId: string, range: string) {
    const { since } = this.rangeFromParam(range);
    const [draftCourses, publishedZero, suspendedUsers, failedPaymentsRows, failedCount, ordersSilentCheck] = await Promise.all([
      this.drizzle.db.select({ n: count() }).from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.isPublished, false), eq(courses.isArchived, false))).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.execute(sql`
        SELECT c.id, c.title, c.slug FROM courses c
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.tenant_id = ${tenantId}
        WHERE c.tenant_id = ${tenantId} AND c.is_published = true
        GROUP BY c.id HAVING COUNT(e.id) = 0
        LIMIT 5
      ` as any).then((r: any) => {
        const rows = Array.isArray(r) ? r : r.rows ?? [];
        return { count: rows.length, sample: rows as { id: string; title: string; slug: string }[] };
      }).catch(() => ({ count: 0, sample: [] as any[] })),
      this.drizzle.db.select({ n: count() }).from(users).where(and(eq(users.tenantId, tenantId), or(eq(users.accountStatus as any, 'suspended'), eq(users.isActive, false)))).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.select({ id: orders.id, total: orders.total, status: orders.status, createdAt: orders.createdAt, userId: orders.userId }).from(orders).where(and(eq(orders.tenantId, tenantId), sql`${orders.status} IN ('failed','expired','cancelled')`, gte(orders.createdAt, since))).orderBy(desc(orders.createdAt)).limit(5).then((r) => r).catch(() => [] as any[]),
      this.drizzle.db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenantId), sql`${orders.status} IN ('failed','expired','cancelled')`, gte(orders.createdAt, since))).then((r) => r[0]?.n ?? 0).catch(() => 0),
      this.drizzle.db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.status as any, 'confirmed'), gte(orders.createdAt, new Date(Date.now() - 30 * 864e5)))).then((r) => r[0]?.n ?? 0).catch(() => 0),
    ]);

    const zeroEnrollment = publishedZero as any;
    const failedPayments = { count: failedCount as number, sample: failedPaymentsRows as any[] };
    const draftCount = draftCourses as number;

    // Get draft sample
    const draftSample = await this.drizzle.db.select({ id: courses.id, title: courses.title, slug: courses.slug }).from(courses).where(and(eq(courses.tenantId, tenantId), eq(courses.isPublished, false), eq(courses.isArchived, false))).limit(5).then((r) => r).catch(() => []);

    return {
      range,
      updatedAt: new Date().toISOString(),
      zeroEnrollmentCourses: { count: zeroEnrollment.count ?? 0, sample: zeroEnrollment.sample ?? [] },
      draftCourses: { count: draftCount, sample: draftSample as any[] },
      failedPayments,
      suspendedUsers: suspendedUsers as number,
      ordersSilent30d: (ordersSilentCheck as number) === 0,
    };
  }

  async getActivity(tenantId: string, range: string, limit = 15) {
    const { since } = this.rangeFromParam(range);
    const lim = Math.min(30, Math.max(1, Number(limit) || 15));
    const [recentUsers, recentEnrollments, recentOrders] = await Promise.all([
      this.drizzle.db.query.users.findMany({
        where: and(eq(users.tenantId, tenantId), gte(users.createdAt, since)),
        orderBy: [desc(users.createdAt)],
        limit: Math.min(lim, 10),
        columns: { id: true, name: true, email: true, createdAt: true },
      }).catch(() => [] as any[]),
      this.drizzle.db.select({
        id: enrollments.id,
        startedAt: enrollments.startedAt,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        userName: users.name,
        userEmail: users.email,
      }).from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .innerJoin(users, eq(enrollments.userId, users.id))
        .where(and(eq(enrollments.tenantId, tenantId), gte(enrollments.startedAt, since)))
        .orderBy(desc(enrollments.startedAt))
        .limit(Math.min(lim, 10)).then((r) => r).catch(() => [] as any[]),
      this.drizzle.db.select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
        userId: orders.userId,
        userName: users.name,
        userEmail: users.email,
      }).from(orders)
        .innerJoin(users, eq(orders.userId, users.id))
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, since), sql`${orders.status} IN ('confirmed','failed','expired')`))
        .orderBy(desc(orders.createdAt))
        .limit(Math.min(lim, 10)).then((r) => r).catch(() => [] as any[]),
    ]);

    type ActivityItem = { id: string; type: 'signup' | 'enrollment' | 'payment_confirmed' | 'payment_failed'; title: string; subtitle: string; at: string; href: string; meta?: string };
    const items: ActivityItem[] = [];

    for (const u of recentUsers as any[]) {
      items.push({
        id: `user-${u.id}`,
        type: 'signup',
        title: u.name ? `${u.name} signed up` : `${u.email.split('@')[0]} signed up`,
        subtitle: u.email,
        at: (u.createdAt as Date).toISOString(),
        href: `/admin/users?focus=${u.id}`,
      });
    }
    for (const e of recentEnrollments as any[]) {
      items.push({
        id: `enr-${e.id}`,
        type: 'enrollment',
        title: `${e.userName || e.userEmail.split('@')[0]} enrolled in ${e.courseTitle}`,
        subtitle: e.courseTitle,
        at: (e.startedAt as Date).toISOString(),
        href: e.courseSlug ? `/admin/courses/${e.courseSlug}/edit` : '/admin/courses',
        meta: e.courseTitle,
      });
    }
    for (const o of recentOrders as any[]) {
      const isFailed = ['failed', 'expired', 'cancelled'].includes(String(o.status));
      items.push({
        id: `ord-${o.id}`,
        type: isFailed ? 'payment_failed' : 'payment_confirmed',
        title: isFailed ? `Payment failed — ${o.userName || o.userEmail.split('@')[0]}` : `Payment confirmed — ${o.userName || o.userEmail.split('@')[0]}`,
        subtitle: `${(Number(o.total) / 100).toFixed(2)} · ${o.status}`,
        at: (o.createdAt as Date).toISOString(),
        href: isFailed ? '/admin/analytics' : '/admin/analytics',
        meta: String(o.status),
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { items: items.slice(0, lim), updatedAt: new Date().toISOString(), range };
  }

  async listSponsors(tenantId: string) {
    return this.drizzle.db.query.sponsors.findMany({
      where: eq(sponsors.tenantId, tenantId),
      orderBy: [desc(sponsors.sortOrder)],
    });
  }

  async createSponsor(tenantId: string, data: any) {
    const [sponsor] = await this.drizzle.db.insert(sponsors).values({
      tenantId,
      name: data.name,
      description: data.description,
      tier: data.tier || 'General',
      websiteUrl: data.websiteUrl,
      logoUrl: data.logoUrl,
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive !== false,
    }).returning();
    return sponsor;
  }

  async updateSponsor(tenantId: string, id: string, data: any) {
    const [existing] = await this.drizzle.db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.id, id), eq(sponsors.tenantId, tenantId)));
    if (!existing) throw new NotFoundException('Sponsor not found');
    const [updated] = await this.drizzle.db.update(sponsors).set({
      name: data.name,
      description: data.description,
      tier: data.tier,
      websiteUrl: data.websiteUrl,
      logoUrl: data.logoUrl,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    }).where(and(eq(sponsors.id, id), eq(sponsors.tenantId, tenantId))).returning();
    return updated;
  }

  async deleteSponsor(tenantId: string, id: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.id, id), eq(sponsors.tenantId, tenantId)));
    if (!existing) throw new NotFoundException('Sponsor not found');
    await this.drizzle.db.delete(sponsors).where(and(eq(sponsors.id, id), eq(sponsors.tenantId, tenantId)));
    return { deleted: true };
  }

  async listOrders(tenantId: string, page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;
    const [rows, totalRes] = await Promise.all([
      this.drizzle.db.select().from(orders).where(eq(orders.tenantId, tenantId)).orderBy(desc(orders.createdAt)).limit(l).offset(offset),
      this.drizzle.db.select({ count: count() }).from(orders).where(eq(orders.tenantId, tenantId)).then((r) => r[0]),
    ]);
    return { items: rows, total: totalRes?.count ?? 0, page: p, limit: l };
  }

  // ---- Dashboard pulse for admin-dashboard controller ----
  async getDashboardPulse(tenantId: string) {
    const [stats, enrollmentsSeries, revenueSeries, topCourses] = await Promise.all([
      this.getStats(tenantId),
      this.getEnrollmentsSeries(tenantId, '30d'),
      this.getRevenueSeries(tenantId, '30d'),
      this.getTopCourses(tenantId, '30d', 5),
    ]);
    return { stats, enrollmentsSeries, revenueSeries, topCourses };
  }

  // ---- Tenant profile (admin-tenant controller) ----
  async getTenantProfile(tenantId: string) {
    const tenant = await this.drizzle.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenantProfile(_actorId: string, tenantId: string, data: any) {
    const [existing] = await this.drizzle.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (!existing) throw new NotFoundException('Tenant not found');
    const [updated] = await this.drizzle.db
      .update(tenants)
      .set({
        name: data.name,
        slug: data.slug,
        description: data.description,
        domain: data.domain,
        logoUrl: data.logoUrl,
        faviconUrl: data.faviconUrl,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        fontFamily: data.fontFamily,
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated;
  }

  // ---- Staff management ----
  async listStaff(tenantId: string, page = 1, limit = 20, search?: string, role?: string, status?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const staffRoles = ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'];
    const conditions = [eq(users.tenantId, tenantId), or(...staffRoles.map(r => eq(users.role, r)))];
    const searchCond = this.buildSearchCondition(search);
    if (searchCond) conditions.push(searchCond);
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.accountStatus, status));

    const where = and(...conditions);

    const [rows, totalRes] = await Promise.all([
      this.drizzle.db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(l).offset(offset),
      this.drizzle.db.select({ count: count() }).from(users).where(where).then((r) => r[0]),
    ]);

    return { items: rows.map(u => this.sanitizeUser(u)), total: totalRes?.count ?? 0, page: p, limit: l };
  }

  async inviteStaff(tenantId: string, _actorId: string, data: { email: string; role: string; name?: string; username?: string }) {
    const STAFF_ROLES = ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'];
    if (!STAFF_ROLES.includes(data.role)) {
      throw new NotFoundException('Invalid role for staff');
    }
    
    const [existing] = await this.drizzle.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, data.email)));
    if (existing) throw new NotFoundException('User already exists in this tenant');

    const tempPassword = Math.random().toString(36).slice(-10);
    const [user] = await this.drizzle.db.insert(users).values({
      tenantId,
      email: data.email,
      username: data.username,
      name: data.name || data.email.split('@')[0],
      role: data.role as any,
      accountStatus: 'pending',
      passwordHash: tempPassword, // will be replaced on first login
    }).returning();
    
    return this.sanitizeUser(user);
  }

  // Learners (Users section - learners only)
  async listLearners(tenantId: string, page = 1, limit = 20, search?: string, status?: string, from?: string, to?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const conditions = [eq(users.tenantId, tenantId), eq(users.role, 'learner')];
    const searchCond = this.buildSearchCondition(search);
    if (searchCond) conditions.push(searchCond);
    if (status) conditions.push(eq(users.accountStatus, status));
    if (from) conditions.push(gte(users.createdAt, new Date(from)));
    if (to) conditions.push(lte(users.createdAt, new Date(`${to}T23:59:59.999Z`)));

    const where = and(...conditions);

    const [rows, totalRes] = await Promise.all([
      this.drizzle.db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(l).offset(offset),
      this.drizzle.db.select({ count: count() }).from(users).where(where).then((r) => r[0]),
    ]);

    return { items: rows.map(u => this.sanitizeUser(u)), total: totalRes?.count ?? 0, page: p, limit: l };
  }

  // User purchases (orders)
  async getUserPurchases(tenantId: string, userId: string, page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const [rows, totalRes] = await Promise.all([
      this.drizzle.db
        .select({
          id: orders.id,
          total: orders.total,
          subtotal: orders.subtotal,
          tax: orders.tax,
          shipping: orders.shipping,
          currency: orders.currency,
          status: orders.status,
          stripeSessionId: orders.stripeSessionId,
          stripePaymentIntentId: orders.stripePaymentIntentId,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId)))
        .orderBy(desc(orders.createdAt))
        .limit(l)
        .offset(offset),
      this.drizzle.db.select({ count: count() }).from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.userId, userId))).then((r) => r[0]),
    ]);

    return { items: rows, total: totalRes?.count ?? 0, page: p, limit: l };
  }

  // User enrollments
  async getUserEnrollments(tenantId: string, userId: string, page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const [rows, totalRes] = await Promise.all([
      this.drizzle.db
        .select({
          id: enrollments.id,
          status: enrollments.status,
          startedAt: enrollments.startedAt,
          completedAt: enrollments.completedAt,
          certificateId: enrollments.certificateId,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
          courseThumbnail: courses.thumbnailUrl,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.userId, userId)))
        .orderBy(desc(enrollments.startedAt))
        .limit(l)
        .offset(offset),
      this.drizzle.db.select({ count: count() }).from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.userId, userId))).then((r) => r[0]),
    ]);

    return { items: rows, total: totalRes?.count ?? 0, page: p, limit: l };
  }

  // User certificates
  async getUserCertificates(tenantId: string, userId: string, page = 1, limit = 20) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const [rows, totalRes] = await Promise.all([
      this.drizzle.db
        .select({
          id: certifications.id,
          certificateNumber: certifications.certificateNumber,
          issuedAt: certifications.issuedAt,
          expiresAt: certifications.expiresAt,
          revokedAt: certifications.revokedAt,
          pdfUrl: certifications.pdfUrl,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
        })
        .from(certifications)
        .innerJoin(courses, eq(certifications.courseId, courses.id))
        .where(and(eq(certifications.tenantId, tenantId), eq(certifications.userId, userId)))
        .orderBy(desc(certifications.issuedAt))
        .limit(l)
        .offset(offset),
      this.drizzle.db.select({ count: count() }).from(certifications).where(and(eq(certifications.tenantId, tenantId), eq(certifications.userId, userId))).then((r) => r[0]),
    ]);

    return { items: rows, total: totalRes?.count ?? 0, page: p, limit: l };
  }

  // User learning progress
  async getUserLearningProgress(tenantId: string, userId: string) {
    const [totalEnrollments, completedLessons, totalWatchTime, certificates] = await Promise.all([
      this.drizzle.db.select({ count: count() })
        .from(enrollments)
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.userId, userId)))
        .then((r) => r[0]?.count ?? 0),
      this.drizzle.db.select({ count: count() })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.tenantId, tenantId), eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)))
        .then((r) => r[0]?.count ?? 0),
      this.drizzle.db.select({ sum: sql<number>`COALESCE(SUM(watch_time_seconds), 0)` })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.tenantId, tenantId), eq(lessonProgress.userId, userId)))
        .then((r) => Number(r[0]?.sum ?? 0)),
      this.drizzle.db.select({ count: count() })
        .from(certifications)
        .where(and(eq(certifications.tenantId, tenantId), eq(certifications.userId, userId)))
        .then((r) => r[0]?.count ?? 0),
    ]);

    return {
      totalEnrollments,
      completedLessons,
      totalWatchTimeSeconds: totalWatchTime,
      certificatesEarned: certificates,
    };
  }
}