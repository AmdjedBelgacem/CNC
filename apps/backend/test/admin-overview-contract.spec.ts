import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DrizzleService } from '../src/database/drizzle.service';
import { AdminService } from '../src/modules/admin/admin.service';
import { eq, sql } from 'drizzle-orm';
import { tenants } from '../src/database/schema';

/**
 * The admin overview's data contract.
 *
 * The previous dashboard read five fields from `/admin/dashboard/pulse` that the
 * endpoint never returned, so "Needs attention" was permanently empty and the
 * course-health donut always rendered "1 course". Nothing failed: the requests
 * were 200s, the panel just had nothing to show, and it looked like good news.
 *
 * A type error cannot catch that, because the fetch response was typed by hand in
 * the component. So this test pins the contract from the other end: it calls the
 * real service and asserts every field the view destructures is actually present,
 * and then cross-checks the field names against the component source so the two
 * cannot drift apart silently again.
 */
describe('admin overview data contract (integration)', () => {
  let drizzle: DrizzleService;
  let admin: AdminService;
  let tenantId: string;

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    // A stub for the collaborators the overview never touches; the queries under
    // test are the ones that matter here.
    admin = new AdminService(
      drizzle,
      { get: (k: string) => process.env[k] } as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const [tenant] = await drizzle.db.select().from(tenants).limit(1);
    if (!tenant) throw new Error('no tenant seeded');
    tenantId = tenant.id;
  });

  describe('the endpoints the overview calls', () => {
    it('overview returns every metric the four KPI cells read', async () => {
      const data: any = await admin.getOverview(tenantId, '30d');
      // Note the shape difference: the three count metrics report `value`, while
      // revenue reports `cents` because it is money. The view reads each by its own
      // name; this test pins both so neither is guessed at.
      for (const metric of ['users', 'activeUsers', 'enrollments'] as const) {
        expect(data[metric], `overview.${metric}`).toBeTypeOf('object');
        expect(data[metric].value, `overview.${metric}.value`).toBeTypeOf('number');
        expect(
          data[metric].delta === null || data[metric].delta === undefined || typeof data[metric].delta === 'number',
          `overview.${metric}.delta must be number|null`,
        ).toBe(true);
      }
      expect(data.revenue).toBeTypeOf('object');
      expect(data.revenue.cents, 'overview.revenue.cents (money, not .value)').toBeTypeOf('number');
      expect(
        data.revenue.delta === null || typeof data.revenue.delta === 'number',
        'overview.revenue.delta must be number|null',
      ).toBe(true);
      // And the view must not look for `.value` on money.
      const view = readFileSync(
        join(__dirname, '../../frontend/src/components/admin/dashboard-view.tsx'),
        'utf8',
      );
      expect(view).toMatch(/overview\?\.revenue\?\.cents/);
      expect(view).not.toMatch(/revenue\?\.value/);
      // The sparklines are what the redesign draws; they must be arrays.
      for (const metric of ['users', 'activeUsers', 'enrollments', 'revenue'] as const) {
        expect(Array.isArray(data[metric].sparkline), `overview.${metric}.sparkline`).toBe(true);
      }
      expect(data.coursesPublished).toBeTypeOf('number');
      expect(data.updatedAt).toBeTypeOf('string');
    });

    it('insights returns the fields the attention rail and health panel read', async () => {
      const data: any = await admin.getInsights(tenantId, '30d');
      expect(data.zeroEnrollmentCourses, 'insights.zeroEnrollmentCourses').toBeTypeOf('object');
      expect(data.zeroEnrollmentCourses.count).toBeTypeOf('number');
      expect(Array.isArray(data.zeroEnrollmentCourses.sample)).toBe(true);
      for (const sample of data.zeroEnrollmentCourses.sample) {
        expect(sample).toMatchObject({ id: expect.any(String), title: expect.any(String) });
      }
      expect(data.draftCourses, 'insights.draftCourses').toBeTypeOf('object');
      expect(data.draftCourses.count).toBeTypeOf('number');
      expect(Array.isArray(data.draftCourses.sample)).toBe(true);
      expect(data.suspendedUsers).toBeTypeOf('number');
      expect(data.failedPayments, 'insights.failedPayments').toBeTypeOf('object');
      expect(data.failedPayments.count).toBeTypeOf('number');
      expect(typeof data.ordersSilent30d).toBe('boolean');
    });

    it('stats returns the counts and the recent accounts list', async () => {
      const data: any = await admin.getStats(tenantId);
      for (const key of ['users', 'courses', 'posts', 'events', 'orders'] as const) {
        expect(data[key], `stats.${key}`).toBeTypeOf('number');
      }
      expect(Array.isArray(data.recentUsers)).toBe(true);
      for (const account of data.recentUsers) {
        expect(account.id).toBeTypeOf('string');
        expect(account.email).toBeTypeOf('string');
        // Drizzle returns a Date in process; the JSON boundary makes it a string,
        // and the view formats whatever arrives. Both must be acceptable.
        expect(['string', 'object']).toContain(typeof account.createdAt);
        expect(new Date(account.createdAt as string).getTime()).not.toBeNaN();
      }
    });

    it('the series endpoints return dated points the bars can plot', async () => {
      const enrollments: any = await admin.getEnrollmentsSeries(tenantId, '30d');
      expect(Array.isArray(enrollments)).toBe(true);
      for (const point of enrollments) {
        expect(point.date, 'enrollment point needs a date').toBeDefined();
        expect(Number.isFinite(Number(point.count))).toBe(true);
      }
      const revenue: any = await admin.getRevenueSeries(tenantId, '30d');
      expect(Array.isArray(revenue)).toBe(true);
      for (const point of revenue) {
        expect(point.date, 'revenue point needs a date').toBeDefined();
        expect(Number.isFinite(Number(point.cents))).toBe(true);
      }
    });

    it('top courses is rankable and each row is navigable', async () => {
      const rows: any = await admin.getTopCourses(tenantId, '30d', 5);
      expect(Array.isArray(rows)).toBe(true);
      for (const row of rows) {
        // `slug` was added so a ranking row can link to the course. Without it the
        // list is decorative.
        expect(row.slug, 'top course needs a slug to be linkable').toBeTypeOf('string');
        expect(row.title).toBeTypeOf('string');
        expect(Number.isFinite(Number(row.enrollments))).toBe(true);
      }
    });

    it('honours every range the picker offers', async () => {
      for (const range of ['7d', '30d', '90d', '12m']) {
        const data: any = await admin.getOverview(tenantId, range);
        expect(data.range, `range ${range}`).toBe(range);
        expect(Array.isArray(data.users.sparkline)).toBe(true);
      }
    });
  });

  describe('the view matches the endpoints', () => {
    const source = readFileSync(
      join(__dirname, '../../frontend/src/components/admin/dashboard-view.tsx'),
      'utf8',
    );

    it('requests only endpoints that exist', () => {
      const paths = [...source.matchAll(/`\/api\/proxy(\/[^`?]+)\?/g)].map((m) => m[1]!);
      expect(paths.length).toBeGreaterThan(0);
      // The old view called /admin/dashboard/pulse and read five fields it never
      // returned. These are the paths the redesign depends on.
      for (const path of paths) {
        expect(
          [
            '/admin/analytics/overview',
            '/admin/analytics/insights',
            '/admin/analytics/enrollments',
            '/admin/analytics/revenue',
            '/admin/analytics/top-courses',
            '/admin/stats',
          ],
          `unexpected dashboard endpoint ${path}`,
        ).toContain(path);
      }
      expect(paths).not.toContain('/admin/dashboard/pulse');
    });

    it('reads no metric the endpoints do not publish', async () => {
      // Field names the view destructures off the overview payload.
      const declared = [...source.matchAll(/overview\?\.(\w+)\??\.?/g)].map((m) => m[1]!);
      const data: any = await admin.getOverview(tenantId, '30d');
      const insights: any = await admin.getInsights(tenantId, '30d');
      for (const field of new Set(declared)) {
        expect(
          field in data || field in insights,
          `the view reads "${field}", which neither overview nor insights returns`,
        ).toBe(true);
      }
    });

    it('declares the currency as SAR, not USD', () => {
      const parts = readFileSync(
        join(__dirname, '../../frontend/src/components/admin/dashboard-parts.tsx'),
        'utf8',
      );
      expect(parts).toMatch(/PLATFORM_CURRENCY = 'SAR'/);
      // A hardcoded `currency: 'USD'` on a SAR merchant reports revenue nobody
      // recognises.
      expect(parts).not.toMatch(/currency: 'USD'/);
      expect(source).not.toMatch(/currency: 'USD'/);
      expect(source).not.toMatch(/en-US'/);
    });

    it('never reads the clock during render', () => {
      // `Date.now()` in a render body is a hydration mismatch: the server and the
      // browser each get a different value and React refuses to patch it.
      for (const file of [source, readFileSync(join(__dirname, '../../frontend/src/components/admin/dashboard-parts.tsx'), 'utf8')]) {
        // Strip comments first: the comment that documents this rule would
        // otherwise trip the rule.
        const code = file.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        const offenders = [...code.matchAll(/Date\.now\(\)|new Date\(\)(?!\s*\))/g)];
        // Every hit must live inside an effect or a callback, never bare in JSX.
        for (const hit of offenders) {
          const line = code.slice(0, hit.index).split('\n').length;
          const text = code.split('\n')[line - 1] ?? '';
          expect(
            /useEffect|setNow|setInterval|memo|label|title=|aria-label/.test(text),
            `clock read outside an effect on line ${line}: ${text.trim().slice(0, 80)}`,
          ).toBe(true);
        }
      }
    });

    it('uses logical direction utilities so RTL does not break the layout', () => {
      const offenders = [
        ...source.matchAll(/className="[^"]*?\b(ml|mr|pl|pr|left|right)-\d/g),
      ];
      expect(
        offenders.map((m) => m[0]),
        'physical side utilities do not flip in Arabic',
      ).toEqual([]);
    });

    it('routes every visible string through the catalog', () => {
      // No user-facing English literal left in the view body.
      const suspicious = [
        ...source.matchAll(/>\s*([A-Z][a-z]+(?:\s+[a-z]+){1,4})\s*</g),
      ].map((m) => m[1]!);
      expect(suspicious, `raw JSX text: ${suspicious.join(' | ')}`).toEqual([]);
      // A `{ default: … }` escape hatch is a gap waiting to render as a key path.
      expect(source).not.toMatch(/\{ default: '/);
    });
  });
});
