import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

/**
 * A learner who never enrolled or paid could post progress for every lesson of a paid course
 * and be auto-issued a certificate. Playback and quizzes were gated; progress was not.
 */
describe('lesson progress needs the same access as playback', () => {
  const service = read('modules/courses/courses.service.ts');
  const body = service.slice(service.indexOf('async upsertProgress'), service.indexOf('async upsertProgress') + 600);

  it('checks access before anything is written', () => {
    expect(body).toMatch(/await this\.assertCanRecordProgress\(/);
    expect(body.indexOf('assertCanRecordProgress')).toBeLessThan(body.indexOf('getLessonProgress'));
  });

  it('uses the playback rule, so free previews work and admins keep their bypass', () => {
    const helper = service.slice(service.indexOf('private async assertCanRecordProgress'), service.indexOf('async upsertProgress'));
    expect(helper).toMatch(/this\.canAccessLesson\(/);
    expect(helper).toMatch(/ForbiddenException\('Enroll in the course/);
  });

  it('passes the real viewer from the controller and from quiz grading', () => {
    const controller = read('modules/courses/courses.controller.ts');
    expect(controller).toMatch(/quizScore: dto\.quizScore,\s*\}, user\)/);
    expect(service).toMatch(/upsertProgress\(viewer\.id, lesson\.id, tenantId, \{\}, viewer\)/);
  });
});

describe('self-enrolment respects the access mode', () => {
  const service = read('modules/courses/courses.service.ts');
  const enroll = service.slice(service.indexOf('async enrollUser'), service.indexOf('async getUserEnrollments'));

  it('refuses a paid course unless the payment pipeline is the caller', () => {
    expect(enroll).toMatch(/if \(!opts\.fulfilledPayment\)/);
    expect(enroll).toMatch(/mode === 'paid' && \(course\.priceCents \?\? 0\) > 0/);
    expect(enroll).toMatch(/ForbiddenException\('This course has to be purchased/);
  });

  it('refuses an invite-only course', () => {
    expect(enroll).toMatch(/mode === 'invite'/);
  });

  it('only the payment pipeline passes the bypass', () => {
    const callers = ['modules/courses/courses.controller.ts', 'modules/payments/moyasar.service.ts'].map((file) => ({
      file,
      src: read(file),
    }));
    expect(callers[0]!.src).not.toMatch(/fulfilledPayment/);
    expect(callers[1]!.src).toMatch(/fulfilledPayment: true/);
  });
});

describe('a priced event is a ticket, not a label', () => {
  it('register() refuses it unless the payment pipeline is the caller', () => {
    const events = read('modules/events/events.service.ts');
    const body = events.slice(events.indexOf('async register('), events.indexOf('async cancelRegistration'));
    expect(body).toMatch(/!opts\.fulfilledPayment && \(event\.price \?\? 0\) > 0/);
    expect(body).toMatch(/ForbiddenException\('This event requires a ticket purchase'\)/);
    expect(read('modules/payments/moyasar.service.ts')).toMatch(/events\.register\(line\.refId!, userId, tenantId, \{ fulfilledPayment: true \}\)/);
  });

  it('the page sends a priced event through the gateway and prices it in SAR', () => {
    const page = readFileSync(resolve(__dirname, '../../frontend/src/app/(main)/events/[slug]/page.tsx'), 'utf8');
    expect(page).toMatch(/itemType: 'event_ticket'/);
    expect(page).not.toMatch(/\$\{\(event\.price \/ 100\)/);
  });
});
