import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newCertificateNumber } from '../src/modules/certification/certification.service';
import { MEMBER_VISIBLE_COLUMNS } from '../src/modules/users/users.service';

const src = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');

describe('certificates', () => {
  it('numbers are random, not derived from the clock', () => {
    const at = new Date('2026-11-14T10:00:00Z');
    const a = newCertificateNumber(at);
    const b = newCertificateNumber(at);
    expect(a).toMatch(/^TMF-2026-[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(a).not.toBe(b);
  });

  it('a learner can only claim a certificate for a course they completed in this tenant', () => {
    const service = src('modules/certification/certification.service.ts');
    const issue = service.slice(service.indexOf('async issue('), service.indexOf('private async assertCourseCompleted'));
    expect(issue).toMatch(/await this\.assertCourseCompleted\(tenantId, userId, courseId\)/);
    const check = service.slice(service.indexOf('private async assertCourseCompleted'));
    expect(check).toMatch(/eq\(courses\.tenantId, tenantId\)/);
    expect(check).toMatch(/ne\(enrollments\.status, 'cancelled'\)/);
    expect(check).toMatch(/total === 0 \|\| Number\(row\?\.done \?\? 0\) < total/);
  });

  it('public verification is rate-limited', () => {
    const controller = src('modules/certification/certification.controller.ts');
    expect(controller).toMatch(/@Throttle\(\{ default: \{ ttl: 60_000, limit: 20 \} \}\)\s*@Get\('verify\/:number'\)/);
  });
});

describe('progress', () => {
  it('has no route that records lesson completion without the enrollment check', () => {
    const controller = src('modules/progress/progress.controller.ts');
    expect(controller).not.toMatch(/@Post\(/);
  });
});

describe('users', () => {
  it('another member sees only public profile fields', () => {
    for (const key of ['passwordHash', 'email', 'authUserId', 'lastLoginIp', 'tenantId', 'metadata']) {
      expect(Object.keys(MEMBER_VISIBLE_COLUMNS)).not.toContain(key);
    }
    expect(src('modules/users/users.service.ts')).toMatch(/columns: MEMBER_VISIBLE_COLUMNS/);
  });
});

describe('payments', () => {
  it('a payment settles only the order it was made for, and only once', () => {
    const moyasar = src('modules/payments/moyasar.service.ts');
    const settle = moyasar.slice(moyasar.indexOf('async settleFromPayment'));
    expect(settle.indexOf('paymentBinding(')).toBeGreaterThan(0);
    expect(settle.indexOf('paymentBinding(')).toBeLessThan(settle.indexOf('payment.amount !== order.total'));
    expect(moyasar).toMatch(/refOrderId !== order\.id \|\| !this\.verifyOrderRef/);
    expect(moyasar).toMatch(/'payment_already_used'/);
  });

  it('the untyped legacy Stripe checkout route is gone', () => {
    expect(src('modules/payments/payments.controller.ts')).not.toMatch(/@Post\('checkout'\)/);
  });
});

describe('titan tv', () => {
  it('lists only the request tenant', () => {
    expect(src('modules/titan-tv/titan-tv.service.ts')).toMatch(/where: eq\(videoSeries\.tenantId, tenantId\)/);
    expect(src('modules/titan-tv/titan-tv.controller.ts')).toMatch(/if \(!tenant\?\.id\) return \{ data: \[\] \}/);
  });
});
