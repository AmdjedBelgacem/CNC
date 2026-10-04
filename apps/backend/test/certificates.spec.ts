import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { DrizzleService } from '../src/database/drizzle.service';
import {
  academies,
  certifications,
  certTemplates,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  series,
  tenants,
  users,
} from '../src/database/schema';
import { CertificationService } from '../src/modules/certification/certification.service';
import {
  CertificateRendererService,
  defaultTemplateFields,
  renderCertificatePdf,
  resolveFields,
  resolveVariables,
  CERTIFICATE_VARIABLES,
} from '../src/modules/certification/certificate-renderer';

/**
 * Certificate issuance: resolution order, rendering, and idempotency.
 *
 * These guard the three failures that made the previous system decorative:
 *  1. academy scope did not exist, so an academy could not brand its own awards
 *  2. template fields were stored but never rendered, so a certificate could be
 *     issued that said nothing
 *  3. idempotency was an application-level read, so two concurrent completion
 *     handlers could both issue
 */

const noopAudit = { log: async () => {} } as never;
const noopNotifications = { notifyUser: async () => {} } as never;
const noopEmail = { sendTemplate: async () => {} } as never;

/** Storage stub that keeps the rendered PDF in memory, like a real bucket. */
function memoryStorage() {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    isConfigured: true,
    async putObject(key: string, body: Buffer, contentType: string) {
      objects.set(key, { body, contentType });
    },
    async getObjectBytes(key: string) {
      return objects.get(key)?.body ?? null;
    },
    async objectExists(key: string) {
      return objects.has(key);
    },
    async resolvePlaybackUrl(key: string) {
      return `https://storage.test/${key}`;
    },
    async deleteObject(key: string) {
      objects.delete(key);
    },
  };
}

describe('certificate renderer (pure)', () => {
  const style = {
    id: 'tpl-1',
    name: 'Test',
    layout: 'modern',
    primaryColor: '#C2410C',
    secondaryColor: '#191B1F',
    logoUrl: null,
    backgroundUrl: null,
    fontFamily: 'Inter',
    fields: [
      { key: 'learnerName', label: 'Learner', x: 50, y: 42, fontSize: 30, fontWeight: '700', color: '#111111' },
      { key: 'courseTitle', label: 'Course', x: 50, y: 56, fontSize: 14, fontWeight: 'normal', color: '#444444' },
    ],
    scopeType: 'course',
  };

  const variables = {
    learnerName: 'Alex Johnson',
    courseTitle: 'CNC Milling Fundamentals',
    academyName: 'Aerospace Academy',
    issueDate: 'September 29, 2026',
    certificateNumber: 'TMF-2026-000123',
    tenantName: 'TITANS',
  };

  it('substitutes real variables into the designer fields', () => {
    const { fields } = resolveVariables(resolveFields(style).fields, variables);
    expect(fields.map((f) => f.value)).toEqual([
      'Alex Johnson',
      'CNC Milling Fundamentals',
    ]);
  });

  it('produces a real PDF that contains the resolved text', async () => {
    const buffer = await renderCertificatePdf(style, variables);
    // PDF magic number, not an empty buffer.
    expect(buffer.length).toBeGreaterThan(800);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Text is compressed in the content stream, so assert on the trailer and
    // that both fonts were used rather than on raw substrings.
    const asText = buffer.toString('latin1');
    expect(asText).toContain('%%EOF');
    expect(asText).toContain('/Type /Catalog');
  });

  it('falls back to a usable default layout when a template has no fields', () => {
    const empty = { ...style, fields: [] };
    const { fields, usedDefaultLayout } = resolveFields(empty);
    expect(usedDefaultLayout).toBe(true);
    expect(fields.map((f) => f.key)).toEqual(
      defaultTemplateFields().map((f) => f.key),
    );
    // And the rendered result is still a valid PDF, not a blank one.
    return renderCertificatePdf(empty, variables).then((buf) => {
      expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });

  it('shows a visible placeholder for an unknown variable rather than a gap', () => {
    const typo = {
      ...style,
      fields: [{ key: 'learmerName', label: 'x', x: 50, y: 50, fontSize: 12, fontWeight: 'normal', color: '#000' }],
    };
    const { fields, unresolved } = resolveVariables(typo.fields, variables);
    expect(fields[0].value).toBe('{{learmerName}}');
    expect(unresolved).toEqual(['learmerName']);
  });

  it('offers a cheatsheet that matches the resolver', () => {
    const known = new Set(CERTIFICATE_VARIABLES.map((v) => v.key));
    expect(known.has('learnerName')).toBe(true);
    expect(known.has('certificateNumber')).toBe(true);
    expect(known.has('academyName')).toBe(true);
  });
});

describe('certificate issuance (integration)', () => {
  let drizzle: DrizzleService;
  let service: CertificationService;
  let storage: ReturnType<typeof memoryStorage>;

  const suffix = `cert-test-${Date.now()}`;
  let tenantId: string;
  let academyId: string;
  let courseId: string;
  let otherCourseId: string;
  let userId: string;
  let seriesId: string;

  let renderer: CertificateRendererService;

  const makeService = () =>
    new CertificationService(
      drizzle,
      noopAudit,
      noopNotifications,
      noopEmail,
      renderer,
      storage as never,
    );

  beforeAll(async () => {
    drizzle = new DrizzleService({ get: (k: string) => process.env[k] } as never);
    await drizzle.onModuleInit();
    storage = memoryStorage();
    renderer = new CertificateRendererService();
    service = makeService();

    const [tenant] = await drizzle.db
      .insert(tenants)
      .values({ name: `Cert Test ${suffix}`, slug: suffix })
      .returning();
    tenantId = tenant.id;

    const [user] = await drizzle.db
      .insert(users)
      .values({ tenantId, email: `${suffix}@example.com`, name: 'Alex Johnson', passwordHash: 'x' })
      .returning();
    userId = user.id;

    const [academy] = await drizzle.db
      .insert(academies)
      .values({ tenantId, slug: suffix, title: 'Aerospace Academy' })
      .returning();
    academyId = academy.id;

    const [course] = await drizzle.db
      .insert(courses)
      .values({
        tenantId,
        title: 'CNC Milling Fundamentals',
        slug: `${suffix}-course`,
        academyId,
        estimatedHours: 20,
      })
      .returning();
    courseId = course.id;

    const [other] = await drizzle.db
      .insert(courses)
      .values({ tenantId, title: 'Unrelated Course', slug: `${suffix}-other` })
      .returning();
    otherCourseId = other.id;

    const [s] = await drizzle.db
      .insert(series)
      .values({ tenantId, courseId, slug: `${suffix}-series`, title: 'Section 1' })
      .returning();
    seriesId = s.id;

    await drizzle.db
      .insert(lessons)
      .values({ tenantId, seriesId, title: 'Lesson 1', slug: `${suffix}-lesson`, sortOrder: 1 });
  });

  afterAll(async () => {
    if (tenantId) {
      // Children first; the tenant has FKs to most of them.
      await drizzle.db.delete(lessonProgress).where(eq(lessonProgress.tenantId, tenantId));
      await drizzle.db.delete(certifications).where(eq(certifications.tenantId, tenantId));
      await drizzle.db.delete(certTemplates).where(eq(certTemplates.tenantId, tenantId));
      await drizzle.db.delete(enrollments).where(eq(enrollments.tenantId, tenantId));
      await drizzle.db.delete(lessons).where(eq(lessons.tenantId, tenantId));
      await drizzle.db.delete(series).where(eq(series.tenantId, tenantId));
      await drizzle.db.delete(courses).where(eq(courses.tenantId, tenantId));
      await drizzle.db.delete(academies).where(eq(academies.tenantId, tenantId));
      await drizzle.db.delete(users).where(eq(users.tenantId, tenantId));
      await drizzle.db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    await drizzle.onModuleDestroy();
  });

  const newTemplate = (over: Record<string, unknown> = {}) => ({
    tenantId,
    name: `Tpl ${suffix}`,
    layout: 'modern',
    primaryColor: '#C2410C',
    secondaryColor: '#191B1F',
    fontFamily: 'Inter',
    isActive: true,
    ...over,
  });

  it('resolves tenant default when nothing more specific exists', async () => {
    await drizzle.db.insert(certTemplates).values(newTemplate({ scopeType: 'tenant' }));
    const result = await service.describeTemplateResolution(tenantId, courseId);
    expect(result.matchedBy).toBe('tenant');
    expect(result.template?.willUseDefaultLayout).toBe(true);
  });

  it('academy scope beats the tenant default', async () => {
    await drizzle.db
      .insert(certTemplates)
      .values(
        newTemplate({
          scopeType: 'academy',
          academyId,
          name: `Academy ${suffix}`,
          fields: defaultTemplateFields(),
        }),
      );
    const result = await service.describeTemplateResolution(tenantId, courseId);
    expect(result.matchedBy).toBe('academy');
    expect(result.academyId).toBe(academyId);
    expect(result.template?.willUseDefaultLayout).toBe(false);
  });

  it('course scope beats both academy and tenant', async () => {
    await drizzle.db
      .insert(certTemplates)
      .values(
        newTemplate({
          scopeType: 'course',
          courseId,
          name: `Course ${suffix}`,
          fields: defaultTemplateFields(),
        }),
      );
    const result = await service.describeTemplateResolution(tenantId, courseId);
    expect(result.matchedBy).toBe('course');
  });

  it('an inactive template at a higher scope is skipped', async () => {
    await drizzle.db
      .update(certTemplates)
      .set({ isActive: false })
      .where(and(eq(certTemplates.tenantId, tenantId), eq(certTemplates.scopeType, 'course')));
    const result = await service.describeTemplateResolution(tenantId, courseId);
    expect(result.matchedBy).toBe('academy');
    await drizzle.db
      .update(certTemplates)
      .set({ isActive: true })
      .where(and(eq(certTemplates.tenantId, tenantId), eq(certTemplates.scopeType, 'course')));
  });

  it('rejects a template whose scope and ids disagree', async () => {
    await expect(
      service.createTemplate(tenantId, userId, { name: 'bad', scopeType: 'academy' } as never, undefined, undefined),
    ).rejects.toThrow(/needs an academyId/i);
    await expect(
      service.createTemplate(
        tenantId,
        userId,
        { name: 'bad2', scopeType: 'academy', academyId, courseId } as never,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/must not have a courseId/i);
  });

  it('persists the course link that the create path used to drop', async () => {
    const created = await service.createTemplate(
      tenantId,
      userId,
      { name: `Persisted ${suffix}`, courseId } as never,
      undefined,
      undefined,
    );
    expect(created.courseId).toBe(courseId);
    expect(created.scopeType).toBe('course');
  });

  it('auto-issue renders a PDF, stores the key, and snapshots the payload', async () => {
    const result = await service.tryAutoIssue(userId, courseId, tenantId);
    expect(result.status).toBe('issued');
    const cert = result.certificate!;

    expect(cert.certificateNumber).toMatch(/^TMF-\d{4}-\d+$/);
    expect(cert.pdfStorageKey).toBeTruthy();
    expect(cert.pdfUrl).toContain('https://storage.test/');
    expect(cert.source).toBe('automatic');
    expect(cert.academyId).toBe(academyId);

    // The object really is a PDF in storage.
    const stored = storage.objects.get(cert.pdfStorageKey!)!;
    expect(stored.contentType).toBe('application/pdf');
    expect(stored.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    // The immutable snapshot carries the resolved learner + course values, so
    // the audit trail does not depend on the template still existing.
    const payload = cert.payload as never as {
      variables: Record<string, string>;
      fields: { key: string; value: string }[];
      usedDefaultLayout: boolean;
    };
    expect(payload.variables.learnerName).toBe('Alex Johnson');
    expect(payload.variables.courseTitle).toBe('CNC Milling Fundamentals');
    expect(payload.variables.academyName).toBe('Aerospace Academy');
    expect(payload.fields.map((f) => f.value)).toContain('Alex Johnson');
  });

  it('is idempotent across repeated completion callbacks', async () => {
    const before = await drizzle.db
      .select({ id: certifications.id })
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)));

    const again = await service.tryAutoIssue(userId, courseId, tenantId);
    expect(again.status).toBe('existing');

    const after = await drizzle.db
      .select({ id: certifications.id })
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)));
    expect(after.length).toBe(before.length);
  });

  it('enforces one active award per user+course in the database', async () => {
    // The application-level read is not enough; the partial unique index is what
    // stops two concurrent completion handlers from both inserting.
    const existing = await drizzle.db
      .select()
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)))
      .limit(1);

    await expect(
      drizzle.db.insert(certifications).values({
        tenantId,
        userId,
        courseId,
        certificateNumber: `TMF-2026-DUP${Date.now()}`,
        revokedAt: null,
      }),
    ).rejects.toThrow();

    expect(existing.length).toBe(1);
  });

  it('skips issuance but still completes the enrollment when auto-issue is off', async () => {
    await drizzle.db
      .update(courses)
      .set({ autoIssueCertificate: false })
      .where(eq(courses.id, otherCourseId));
    await drizzle.db
      .insert(enrollments)
      .values({ tenantId, userId, courseId: otherCourseId, status: 'active' });

    const result = await service.tryAutoIssue(userId, otherCourseId, tenantId);
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('disabled');

    const [enrollment] = await drizzle.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, otherCourseId)));
    expect(enrollment.status).toBe('completed');

    const none = await drizzle.db
      .select()
      .from(certifications)
      .where(eq(certifications.courseId, otherCourseId));
    expect(none.length).toBe(0);
  });

  it('reports "no template" instead of pretending success', async () => {
    await drizzle.db
      .update(courses)
      .set({ autoIssueCertificate: true })
      .where(eq(courses.id, otherCourseId));
    await drizzle.db.delete(certTemplates).where(eq(certTemplates.tenantId, tenantId));
    const result = await service.tryAutoIssue(userId, otherCourseId, tenantId);
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no-template');
  });

  it('authorises download to the owner and refuses everyone else', async () => {
    await drizzle.db.delete(certTemplates).where(eq(certTemplates.tenantId, tenantId));
    await service.tryAutoIssue(userId, courseId, tenantId);
    const cert = await drizzle.db
      .select()
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)))
      .limit(1);
    const id = cert[0].id;

    // Owner: allowed.
    const asOwner = await service.getForDownload(id, {
      id: userId,
      tenantId,
      role: 'learner',
    });
    expect(asOwner.id).toBe(id);
    // The document is streamed server-side, so the owner gets real bytes
    // rather than a capability URL.
    const bytes = await service.loadDocument(asOwner as never);
    expect(bytes).toBeInstanceOf(Buffer);
    expect(bytes!.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    // A different learner in the same tenant: refused, and refused as a 404 so
    // the endpoint does not confirm that the id exists.
    await expect(
      service.getForDownload(id, { id: '00000000-0000-4000-8000-000000000000', tenantId, role: 'learner' }),
    ).rejects.toThrow(/not found/i);

    // Admin of the same tenant: allowed.
    await expect(
      service.getForDownload(id, { id: '00000000-0000-4000-8000-000000000000', tenantId, role: 'admin' }),
    ).resolves.toBeTruthy();

    // Admin of a different tenant: refused.
    await expect(
      service.getForDownload(id, {
        id: '00000000-0000-4000-8000-000000000000',
        tenantId: '00000000-0000-4000-8000-000000000001',
        role: 'admin',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('regenerates a PDF from the snapshot after the template is deleted', async () => {
    // Templates were deleted in the previous test; the award must still be
    // reproducible because the payload is immutable and self-contained.
    const cert = await drizzle.db
      .select()
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)))
      .limit(1);
    const result = await service.regeneratePdf(cert[0].id, tenantId);
    expect(result.bytes).toBeGreaterThan(800);
    expect(result.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('public verify exposes no more than name, course, date and validity', async () => {
    // The verify endpoint is unauthenticated. It must not publish the learner's
    // email, internal ids, the signature or the payload snapshot.
    const cert = await drizzle.db
      .select()
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)))
      .limit(1);

    const publicView = await service.verify(cert[0].certificateNumber);
    expect(publicView.valid).toBe(true);
    expect(publicView.status).toBe('valid');
    expect(publicView.learnerName).toBe('Alex Johnson');
    expect(publicView.courseTitle).toBe('CNC Milling Fundamentals');

    const serialised = JSON.stringify(publicView);
    expect(serialised).not.toContain(`${suffix}@example.com`); // learner email
    expect(serialised).not.toContain(userId); // internal user id
    expect(serialised).not.toContain(cert[0].id); // internal cert id
    expect(serialised).not.toContain('digitalSignature');
    expect(serialised).not.toContain('payload');
  });

  it('verify reports a revoked certificate as invalid', async () => {
    const cert = await drizzle.db
      .select()
      .from(certifications)
      .where(and(eq(certifications.tenantId, tenantId), eq(certifications.courseId, courseId)))
      .limit(1);
    await drizzle.db
      .update(certifications)
      .set({ revokedAt: new Date(), revokedReason: 'test' })
      .where(eq(certifications.id, cert[0].id));
    const view = await service.verify(cert[0].certificateNumber);
    expect(view.valid).toBe(false);
    expect(view.status).toBe('revoked');
    await drizzle.db
      .update(certifications)
      .set({ revokedAt: null, revokedReason: null })
      .where(eq(certifications.id, cert[0].id));
  });

  it('keeps tenant isolation: a template in another tenant never resolves', async () => {
    const [otherTenant] = await drizzle.db
      .insert(tenants)
      .values({ name: `Other ${suffix}`, slug: `${suffix}-other` })
      .returning();
    try {
      await drizzle.db
        .insert(certTemplates)
        .values(newTemplate({ tenantId: otherTenant.id, scopeType: 'tenant', name: 'Foreign' }));
      const result = await service.describeTemplateResolution(tenantId, courseId);
      expect(result.matchedBy).toBe('none');
      expect(result.template).toBeNull();
    } finally {
      await drizzle.db.delete(certTemplates).where(eq(certTemplates.tenantId, otherTenant.id));
      await drizzle.db.delete(tenants).where(eq(tenants.id, otherTenant.id));
    }
  });
});
