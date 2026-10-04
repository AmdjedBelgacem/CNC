import { Injectable, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { certifications, certTemplates } from '../../database/schema/certifications';
import { academies } from '../../database/schema/academies';
import { enrollments } from '../../database/schema/progress';
import { users } from '../../database/schema/users';
import { courses } from '../../database/schema/courses';
import { tenants } from '../../database/schema/tenants';
import { eq, and, desc, ilike, gte, lte, or, sql, count, isNull } from 'drizzle-orm';
import { generateCertificateNumber } from '@titan/shared';
import * as crypto from 'crypto';
import { AuditService } from '../auth/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../auth/services/email.service';
import { StorageService } from '../storage/storage.service';
import {
  CertificateRendererService,
  resolveFields,
  resolveVariables,
  type CertificateStyle,
  type CertificateVariables,
  type TemplateFieldDef,
} from './certificate-renderer';

/** Shape of a `cert_templates` row that the issue path needs. */
type TemplateRow = {
  id: string;
  name: string;
  scopeType: string;
  courseId: string | null;
  academyId: string | null;
  layout: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  fontFamily: string;
  fields: TemplateFieldDef[] | null;
  isActive: boolean;
};

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private drizzle: DrizzleService,
    private audit: AuditService,
    @Optional() private notifications?: NotificationsService,
    @Optional() private emailService?: EmailService,
    @Optional() private renderer?: CertificateRendererService,
    @Optional() private storage?: StorageService,
  ) {}

  async findByUser(userId: string) {
    return this.drizzle.db.query.certifications.findMany({
      where: eq(certifications.userId, userId),
      with: { course: { columns: { title: true, slug: true } } },
    });
  }

  /**
   * Public certificate verification.
   *
   * This endpoint is unauthenticated, so it returns an explicit minimal shape
   * rather than the row. It previously spread the full record, which published
   * the learner's email, internal ids, the digital signature and the whole
   * payload snapshot to anyone who could guess or obtain a certificate number.
   */
  async verify(certificateNumber: string) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: eq(certifications.certificateNumber, certificateNumber),
      with: {
        user: { columns: { name: true } },
        course: { columns: { title: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const revoked = Boolean(cert.revokedAt);
    const expired = Boolean(cert.expiresAt && new Date(cert.expiresAt).getTime() < Date.now());
    return {
      certificateNumber: cert.certificateNumber,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      valid: !revoked && !expired,
      status: revoked ? 'revoked' : expired ? 'expired' : 'valid',
      revokedAt: cert.revokedAt,
      revokedReason: cert.revokedReason,
      // Enough to be meaningful, and nothing more.
      learnerName: cert.user?.name ?? null,
      courseTitle: cert.course?.title ?? null,
      hasDocument: Boolean(cert.pdfStorageKey || cert.pdfUrl),
    };
  }

  async issue(userId: string, courseId: string, tenantId: string) {
    return this.issueInternal(tenantId, userId, courseId, { source: 'manual' });
  }

  // --- Admin management surface ---

  async findForAdmin(
    tenantId: string,
    opts: {
      q?: string; courseId?: string; userId?: string; status?: string;
      from?: string; to?: string; page?: number; limit?: number;
    },
  ) {
    const baseConditions: any[] = [eq(certifications.tenantId, tenantId)];
    if (opts.courseId) baseConditions.push(eq(certifications.courseId, opts.courseId));
    if (opts.userId) baseConditions.push(eq(certifications.userId, opts.userId));
    if (opts.from) baseConditions.push(gte(certifications.issuedAt, new Date(opts.from)));
    if (opts.to) baseConditions.push(lte(certifications.issuedAt, new Date(`${opts.to}T23:59:59.999Z`)));
    const statusConditions = (status?: string): any[] => {
      if (status === 'revoked') return [sql`${certifications.revokedAt} IS NOT NULL`];
      if (status === 'active') {
        return [
          and(
            sql`${certifications.revokedAt} IS NULL`,
            or(sql`${certifications.expiresAt} IS NULL`, gte(certifications.expiresAt, new Date())),
          ),
        ];
      }
      if (status === 'expired') {
        return [and(lte(certifications.expiresAt, new Date()), sql`${certifications.revokedAt} IS NULL`)];
      }
      return [];
    };
    const conditions: any[] = [...baseConditions, ...statusConditions(opts.status)];
    if (opts.q) {
      const pattern = `%${opts.q}%`;
      baseConditions.push(
        or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(courses.title, pattern), ilike(certifications.certificateNumber, pattern)),
      );
    }

    const where = and(...conditions);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

    const rows = await this.drizzle.db
      .select({
        id: certifications.id,
        certificateNumber: certifications.certificateNumber,
        issuedAt: certifications.issuedAt,
        expiresAt: certifications.expiresAt,
        revokedAt: certifications.revokedAt,
        revokedReason: certifications.revokedReason,
        pdfUrl: certifications.pdfUrl,
        pdfStorageKey: certifications.pdfStorageKey,
        source: certifications.source,
        academyId: certifications.academyId,
        templateId: certifications.templateId,
        metadata: certifications.metadata,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(certifications)
      .innerJoin(users, eq(certifications.userId, users.id))
      .innerJoin(courses, eq(certifications.courseId, courses.id))
      .where(where)
      .orderBy(desc(certifications.issuedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [totalArr, facetEntries] = await Promise.all([
      this.drizzle.db.select({ count: count() }).from(certifications).innerJoin(users, eq(certifications.userId, users.id)).innerJoin(courses, eq(certifications.courseId, courses.id)).where(where),
      // Status facets across the whole filtered set, so the header and the status
      // tabs report every match rather than only the current page.
      Promise.all(
        (['active', 'revoked', 'expired'] as const).map((st) =>
          this.drizzle.db
            .select({ count: count() })
            .from(certifications)
            .innerJoin(users, eq(certifications.userId, users.id))
            .innerJoin(courses, eq(certifications.courseId, courses.id))
            .where(and(...baseConditions, ...statusConditions(st)))
            .then((r) => [st, Number(r[0]?.count ?? 0)] as const),
        ),
      ),
    ]);

    const facets: Record<string, number> = { active: 0, revoked: 0, expired: 0 };
    let facetTotal = 0;
    for (const [key, n] of facetEntries) {
      facets[key] = n;
      facetTotal += n;
    }

    return { items: rows, total: Number(totalArr[0]?.count ?? 0), facets, facetTotal, page, limit };
  }

  async findOneForAdmin(tenantId: string, id: string) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.id, id), eq(certifications.tenantId, tenantId)),
      with: {
        user: { columns: { id: true, name: true, email: true } },
        course: { columns: { id: true, title: true, slug: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  async revoke(tenantId: string, id: string, reason?: string, actorId?: string, ip?: string, userAgent?: string) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.id, id), eq(certifications.tenantId, tenantId)),
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.revokedAt) throw new BadRequestException('Certificate is already revoked');
    const [updated] = await this.drizzle.db
      .update(certifications)
      .set({ revokedAt: new Date(), revokedReason: reason?.slice(0, 500) ?? null })
      .where(and(eq(certifications.id, id), eq(certifications.tenantId, tenantId)))
      .returning();
    await this.audit.log({
      userId: actorId,
      action: 'certificates:revoke',
      entityType: 'certification',
      entityId: id,
      details: { reason, tenantId, courseId: cert.courseId, userId: cert.userId },
      ip,
      userAgent,
      tenantId,
    });
    return updated;
  }

  async reissue(tenantId: string, id: string, actorId?: string, ip?: string, userAgent?: string) {
    const original = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.id, id), eq(certifications.tenantId, tenantId)),
    });
    if (!original) throw new NotFoundException('Certificate not found');

    let created: typeof certifications.$inferSelect | undefined;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        const seq = (Date.now() + attempt) % 1000000;
        const certNumber = generateCertificateNumber('TMF', new Date().getFullYear(), seq);
        const signature = crypto
          .createHash('sha256')
          .update(`${certNumber}:${original.userId}:${original.courseId}:${tenantId}`)
          .digest('hex');
        const [row] = await this.drizzle.db
          .insert(certifications)
          .values({
            tenantId,
            userId: original.userId,
            courseId: original.courseId,
            templateId: original.templateId,
            certificateNumber: certNumber,
            digitalSignature: signature,
            metadata: { ...(original.metadata ?? {}), reissuedFrom: original.certificateNumber },
          })
          .returning();
        created = row;
      } catch (err: any) {
        // unique certificate_number collision — retry with a fresh sequence
        if (attempt === 2) throw err;
      }
    }
    if (!created) throw new Error('Failed to reissue certificate');
    await this.audit.log({
      userId: actorId,
      action: 'certificates:reissue',
      entityType: 'certification',
      entityId: created.id,
      details: { originalId: id, originalNumber: original.certificateNumber, tenantId },
      ip,
      userAgent,
      tenantId,
    });
    return created;
  }

  /**
   * Resolve which template issues an award for a completed course.
   *
   * Order is course -> academy -> tenant default, so a course can always
   * override a house style without editing the default that every other course
   * depends on. Previously only course and tenant were considered, which meant
   * an academy had no say in its own branding.
   *
   * Returns the template plus the academy it is attributed to, because the
   * issued row records the awarding academy for audit.
   */
  private async resolveTemplateForCourse(tenantId: string, courseId: string) {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
      columns: { id: true, academyId: true },
    });
    const academyId = course?.academyId ?? null;

    const courseScoped = await this.drizzle.db.query.certTemplates.findFirst({
      where: and(
        eq(certTemplates.tenantId, tenantId),
        eq(certTemplates.courseId, courseId),
        eq(certTemplates.isActive, true),
      ),
      orderBy: [desc(certTemplates.createdAt)],
    });
    if (courseScoped) {
      return { template: courseScoped as TemplateRow, academyId, matchedBy: 'course' as const };
    }

    if (academyId) {
      const academyScoped = await this.drizzle.db.query.certTemplates.findFirst({
        where: and(
          eq(certTemplates.tenantId, tenantId),
          eq(certTemplates.academyId, academyId),
          eq(certTemplates.isActive, true),
        ),
        orderBy: [desc(certTemplates.createdAt)],
      });
      if (academyScoped) {
        return { template: academyScoped as TemplateRow, academyId, matchedBy: 'academy' as const };
      }
    }

    const tenantDefault = await this.drizzle.db.query.certTemplates.findFirst({
      where: and(
        eq(certTemplates.tenantId, tenantId),
        isNull(certTemplates.courseId),
        isNull(certTemplates.academyId),
        eq(certTemplates.isActive, true),
      ),
      orderBy: [desc(certTemplates.createdAt)],
    });
    if (tenantDefault) {
      return { template: tenantDefault as TemplateRow, academyId, matchedBy: 'tenant' as const };
    }

    return { template: null, academyId, matchedBy: 'none' as const };
  }

  /** Kept for the existing call site in the auto-issue path. */
  private async findActiveTemplateForCourse(tenantId: string, courseId: string) {
    return (await this.resolveTemplateForCourse(tenantId, courseId)).template;
  }

  /**
   * Fetch a certificate for download, authorising the caller.
   *
   * Authorisation is explicit rather than implicit: the owner, or an admin in
   * the same tenant, or a super_admin explicitly acting in that tenant. A
   * certificate carries a learner's name and completion record, so the id alone
   * must never be a bearer token.
   */
  async getForDownload(
    certId: string,
    actor: { id: string; tenantId: string; role: string },
  ) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: eq(certifications.id, certId),
      with: {
        course: { columns: { title: true, slug: true } },
        user: { columns: { name: true, email: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const isOwner = cert.userId === actor.id;
    const isTenantAdmin = cert.tenantId === actor.tenantId && ['super_admin', 'admin'].includes(actor.role);
    if (!isOwner && !isTenantAdmin) {
      throw new NotFoundException('Certificate not found');
    }

    return cert;
  }

  /**
   * Load the certificate document bytes.
   *
   * Reads through StorageService rather than handing a presigned URL to the
   * browser: `pdfUrl` is a capability URL that expires, it can point at a
   * presigned object the viewer has no business holding, and it stays valid
   * after a revoke. Streaming server-side also works for the local-disk driver,
   * which has no public URL at all.
   */
  async loadDocument(cert: typeof certifications.$inferSelect): Promise<Buffer | null> {
    if (cert.pdfStorageKey && this.storage) {
      const bytes = await this.storage.getObjectBytes(cert.pdfStorageKey);
      if (bytes) return bytes;
    }
    // Fall back to whatever URL was recorded at issue time.
    if (cert.pdfUrl && /^https?:\/\//.test(cert.pdfUrl)) {
      try {
        const upstream = await fetch(cert.pdfUrl);
        if (upstream.ok) return Buffer.from(await upstream.arrayBuffer());
      } catch (error: any) {
        this.logger.warn(`Document fetch failed for ${cert.certificateNumber}: ${error?.message}`);
      }
    }
    return null;
  }

  /**
   * Regenerate a certificate PDF from its immutable payload snapshot.
   *
   * The snapshot records the resolved values and layout exactly as issued, so a
   * re-render is faithful even after the template has been edited or deleted.
   */
  async regeneratePdf(certId: string, tenantId: string) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.id, certId), eq(certifications.tenantId, tenantId)),
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    const payload = cert.payload;
    if (!payload) throw new BadRequestException('This certificate predates PDF rendering');
    if (!this.renderer) throw new BadRequestException('Renderer unavailable');

    const style: CertificateStyle = {
      id: payload.templateId,
      name: cert.courseId ? 'Certificate of Completion' : 'Certificate',
      layout: payload.layout ?? 'modern',
      primaryColor: payload.primaryColor ?? '#0E7490',
      secondaryColor: payload.secondaryColor ?? '#0a1628',
      logoUrl: null,
      backgroundUrl: null,
      fontFamily: payload.fontFamily ?? 'Inter',
      fields: payload.fields ?? [],
      scopeType: 'tenant',
    };
    const { buffer } = await this.renderer.render(
      style,
      payload.variables as CertificateVariables,
    );

    let key = cert.pdfStorageKey;
    let url = cert.pdfUrl;
    if (this.storage?.isConfigured) {
      key = key ?? `tenants/${tenantId}/certificates/${cert.certificateNumber}.pdf`;
      await this.storage.putObject(key, buffer, 'application/pdf');
      url = await this.storage.resolvePlaybackUrl(key, 60 * 60 * 24 * 7);
      await this.drizzle.db
        .update(certifications)
        .set({ pdfStorageKey: key, pdfUrl: url })
        .where(eq(certifications.id, certId));
    }
    return { key, url, bytes: buffer.length, buffer };
  }

  /**
   * Accept a course id or slug within a tenant.
   *
   * The id is only tried when the ref actually looks like a UUID: `id` is a uuid
   * column, so passing a slug to it makes Postgres raise `invalid input syntax
   * for type uuid` and the query fails outright rather than simply matching
   * nothing. That aborted the request before the slug lookup could run.
   */
  private async resolveCourseRef(tenantId: string, ref: string) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(ref)) {
      const byId = await this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.id, ref), eq(courses.tenantId, tenantId)),
        columns: { id: true },
      });
      if (byId) return byId;
    }
    return (
      (await this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.slug, ref), eq(courses.tenantId, tenantId)),
        columns: { id: true },
      })) ?? null
    );
  }

  /**
   * Which template would issue for this course right now, and why.
   * Surfaced in the Studio so an admin can see the effective template and the
   * reason a course has no certificate.
   */
  async describeTemplateResolution(tenantId: string, courseRef: string) {
    // The Studio addresses courses by slug, the admin tooling by id. Accept
    // either rather than forcing one caller shape onto the other.
    const resolved = await this.resolveCourseRef(tenantId, courseRef);
    if (!resolved) throw new NotFoundException('Course not found in this tenant');
    const courseId = resolved.id;
    const { template, academyId, matchedBy } = await this.resolveTemplateForCourse(tenantId, courseId);
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
      columns: { autoIssueCertificate: true, title: true },
    });
    return {
      matchedBy,
      autoIssueEnabled: course?.autoIssueCertificate !== false,
      academyId,
      template: template
        ? {
            id: template.id,
            name: template.name,
            layout: template.layout,
            scopeType: template.scopeType,
            fieldCount: template.fields?.length ?? 0,
            willUseDefaultLayout: (template.fields?.length ?? 0) === 0,
          }
        : null,
    };
  }

  private async notifyLearnerCertificateIssued(userId: string, courseId: string, tenantId: string, cert: typeof certifications.$inferSelect) {
    if (!this.notifications && !this.emailService) return;
    try {
      const [user, course, tenant] = await Promise.all([
        this.drizzle.db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.tenantId, tenantId)) }),
        this.drizzle.db.query.courses.findFirst({ where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)) }),
        this.drizzle.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) } as any).catch(() => null),
      ]);
      if (!user) return;
      const frontendUrl = process.env.FRONTEND_URL || 'https://titansofmanufacturing.com';
      const verifyLink = `${frontendUrl.replace(/\/$/, '')}/certificates/verify/${cert.certificateNumber}`;
      const courseTitle = course?.title ?? 'the course';
      const tenantName = (tenant as any)?.name ?? 'TITANS';

      // Polished in-app notification
      const title = `You’ve earned a certificate for ${courseTitle}!`;
      const body = `Congratulations, ${user.name || 'there'}! You’ve successfully completed “${courseTitle}” and your certificate ${cert.certificateNumber} from ${tenantName} is now ready. View and share it from your profile.`;

      if (this.notifications) {
        await this.notifications.create({
          userId,
          type: 'certificate_issued',
          title,
          body,
          data: { courseId, certificateId: cert.id, certificateNumber: cert.certificateNumber, tenantId, verifyLink },
        } as any).catch(() => {});
      }
      if (this.emailService && user.email) {
        const subject = `Your certificate for ${courseTitle} is ready — ${cert.certificateNumber}`;
        const html = `
          <div style="font-family:Inter,Arial,sans-serif; max-width:600px; margin:0 auto; color:#0a1628;">
            <div style="background:#7c3aed; color:white; padding:24px; border-radius:12px 12px 0 0; text-align:center;">
              <h1 style="margin:0; font-size:22px;">Congratulations, ${user.name || 'there'}!</h1>
              <p style="margin:8px 0 0; opacity:0.9;">You’ve completed “${courseTitle}”</p>
            </div>
            <div style="border:1px solid #e5e7eb; border-top:none; padding:24px; border-radius:0 0 12px 12px;">
              <p style="font-size:15px; line-height:1.6;">Your certificate <strong>${cert.certificateNumber}</strong> from <strong>${tenantName}</strong> is now ready.</p>
              <p style="margin:16px 0;">
                <a href="${verifyLink}" style="display:inline-block; background:#7c3aed; color:white; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">View &amp; Verify Certificate</a>
              </p>
              <p style="font-size:13px; color:#6b7280;">Or copy this link: <a href="${verifyLink}" style="color:#7c3aed; word-break:break-all;">${verifyLink}</a></p>
              <p style="font-size:13px; color:#6b7280; margin-top:16px;">Keep learning — your next course awaits.</p>
            </div>
          </div>
        `;
        const text = `Congratulations, ${user.name || 'there'}!\n\nYou’ve completed "${courseTitle}" and your certificate ${cert.certificateNumber} from ${tenantName} is ready.\n\nVerify: ${verifyLink}\n\nKeep learning!`;
        await this.emailService.send({ to: user.email, subject, html, text } as any).catch(() => {});
      }
    } catch (e) {
      this.logger.warn(`Failed to notify learner ${userId} for cert ${cert.id}`, e as any);
    }
  }

  /**
   * Resolve variables, render the PDF, upload it, and return everything needed
   * to persist the issued row.
   *
   * This is the step that was missing entirely: template fields were stored but
   * never consumed, and `pdfUrl` was never written, so an "issued" certificate
   * was a database row and nothing a learner could open.
   *
   * The returned `payload` is written once and never updated, so later edits to
   * a template cannot rewrite what a certificate said when it was issued.
   */
  private async buildArtifact(
    tenantId: string,
    userId: string,
    courseId: string,
    certificateNumber: string,
    template: TemplateRow | null,
    issuedAt: Date,
  ) {
    const [user, course, tenant] = await Promise.all([
      this.drizzle.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true, email: true },
      }),
      this.drizzle.db.query.courses.findFirst({
        where: eq(courses.id, courseId),
        columns: { title: true, slug: true, academyId: true, estimatedHours: true },
      }),
      this.drizzle.db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { name: true },
      }),
    ]);

    const academyId = template?.academyId ?? course?.academyId ?? null;
    const academy = academyId
      ? await this.drizzle.db.query.academies.findFirst({
          where: eq(academies.id, academyId),
          columns: { title: true },
        })
      : null;

    const variables: CertificateVariables = {
      learnerName: user?.name ?? user?.email ?? 'Learner',
      learnerEmail: user?.email ?? undefined,
      courseTitle: course?.title ?? 'Course',
      courseSlug: course?.slug ?? undefined,
      academyName: academy?.title ?? tenant?.name ?? '',
      issueDate: issuedAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      certificateNumber,
      tenantName: tenant?.name ?? 'TITANS',
      hours:
        typeof course?.estimatedHours === 'number' ? String(course.estimatedHours) : undefined,
    };

    // No template at all: still issue, using the built-in default style, so a
    // completed course is never silently unrewarded. The Studio warns about
    // this separately.
    const style: CertificateStyle = template
      ? {
          id: template.id,
          name: template.name,
          layout: template.layout ?? 'modern',
          primaryColor: template.primaryColor ?? '#0E7490',
          secondaryColor: template.secondaryColor ?? '#0a1628',
          logoUrl: template.logoUrl,
          backgroundUrl: template.backgroundUrl,
          fontFamily: template.fontFamily ?? 'Inter',
          fields: template.fields ?? [],
          scopeType: template.scopeType,
        }
      : {
          id: null,
          name: 'Certificate of Completion',
          layout: 'modern',
          primaryColor: '#0E7490',
          secondaryColor: '#0a1628',
          logoUrl: null,
          backgroundUrl: null,
          fontFamily: 'Inter',
          fields: [],
          scopeType: 'tenant',
        };

    let buffer: Buffer | null = null;
    let usedDefaultLayout = true;
    let unresolved: string[] = [];
    if (this.renderer) {
      const rendered = await this.renderer.render(style, variables);
      buffer = rendered.buffer;
      usedDefaultLayout = rendered.usedDefaultLayout;
      unresolved = rendered.unresolved;
    }

    let pdfStorageKey: string | null = null;
    let pdfUrl: string | null = null;
    if (buffer && this.storage?.isConfigured) {
      pdfStorageKey = `tenants/${tenantId}/certificates/${certificateNumber}.pdf`;
      try {
        await this.storage.putObject(pdfStorageKey, buffer, 'application/pdf');
        pdfUrl = await this.storage.resolvePlaybackUrl(pdfStorageKey, 60 * 60 * 24 * 7);
      } catch (error: any) {
        // A storage outage must not lose the award: the row is still valid and
        // the PDF can be regenerated on demand.
        this.logger.error(
          `Certificate upload failed for ${certificateNumber}: ${error?.message}`,
        );
        pdfStorageKey = null;
        pdfUrl = null;
      }
    }

    const { fields: resolvedFields } = resolveVariables(
      resolveFields(style).fields,
      variables,
    );

    const auditVariables: Record<string, string> = Object.fromEntries(
      Object.entries(variables).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
      ),
    );

    return {
      academyId,
      pdfStorageKey,
      pdfUrl,
      payload: {
        templateId: template?.id ?? null,
        variables: auditVariables,
        fields: resolvedFields.map((f) => ({
          key: f.key,
          label: f.label,
          value: f.value,
          x: f.x,
          y: f.y,
          fontSize: f.fontSize,
          fontWeight: f.fontWeight,
          color: f.color,
        })),
        layout: style.layout,
        primaryColor: style.primaryColor,
        secondaryColor: style.secondaryColor,
        fontFamily: style.fontFamily,
        usedDefaultLayout,
        renderedAt: issuedAt.toISOString(),
      },
      byteLength: buffer?.length ?? 0,
      unresolved,
    };
  }

  /**
   * The single issuance path.
   *
   * `issue`, `tryAutoIssue` and `manualIssue` all funnel through here. They used
   * to be three near-duplicate implementations with three copies of the insert
   * logic, which is how the PDF step ended up missing from all of them.
   */
  private async issueInternal(
    tenantId: string,
    userId: string,
    courseId: string,
    opts: {
      templateId?: string | null;
      source: 'automatic' | 'manual';
      actorId?: string;
      expiresAt?: string | null;
      ip?: string;
      userAgent?: string;
      extraMetadata?: Record<string, unknown>;
    },
  ) {
    // Idempotency. The partial unique index on (tenant, user, course) WHERE
    // revoked_at IS NULL is the real guarantee; this read just avoids a
    // pointless insert attempt on the common path.
    const activeExisting = await this.drizzle.db.query.certifications.findFirst({
      where: and(
        eq(certifications.userId, userId),
        eq(certifications.courseId, courseId),
        sql`${certifications.revokedAt} IS NULL`,
      ),
    });
    if (activeExisting) return activeExisting as typeof certifications.$inferSelect;

    let template: TemplateRow | null = null;
    if (opts.templateId) {
      template = (await this.drizzle.db.query.certTemplates.findFirst({
        where: and(eq(certTemplates.id, opts.templateId), eq(certTemplates.tenantId, tenantId)),
      })) as TemplateRow | null;
      if (!template) throw new NotFoundException('Template not found');
      if (!template.isActive) throw new BadRequestException('Template is inactive');
    } else if (opts.source === 'automatic') {
      template = await this.findActiveTemplateForCourse(tenantId, courseId);
    }

    const issuedAt = new Date();
    const seq = issuedAt.getTime() % 1000000;
    const certNumber = generateCertificateNumber('TMF', issuedAt.getFullYear(), seq);
    const signature = crypto
      .createHash('sha256')
      .update(`${certNumber}:${userId}:${courseId}:${tenantId}`)
      .digest('hex');

    const artifact = await this.buildArtifact(
      tenantId,
      userId,
      courseId,
      certNumber,
      template,
      issuedAt,
    );

    const [cert] = await this.drizzle.db
      .insert(certifications)
      .values({
        tenantId,
        userId,
        courseId,
        academyId: artifact.academyId,
        templateId: template?.id ?? null,
        certificateNumber: certNumber,
        digitalSignature: signature,
        source: opts.source,
        expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
        pdfStorageKey: artifact.pdfStorageKey,
        pdfUrl: artifact.pdfUrl,
        payload: artifact.payload,
        metadata: {
          issuedAt: issuedAt.toISOString(),
          source: opts.source,
          issuedBy: opts.actorId ?? userId,
          templateScope: template?.scopeType ?? 'none',
          usedDefaultLayout: artifact.payload.usedDefaultLayout,
          pdfBytes: artifact.byteLength,
          ...(artifact.unresolved.length ? { unresolvedVariables: artifact.unresolved } : {}),
          ...(opts.extraMetadata ?? {}),
        },
      })
      .returning();
    if (!cert) throw new Error('Failed to create certificate');

    await this.drizzle.db
      .update(enrollments)
      .set({ status: 'completed', completedAt: issuedAt, certificateId: cert.id })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

    await this.audit.log({
      userId: opts.actorId ?? userId,
      action: 'certificates:issue',
      entityType: 'certification',
      entityId: cert.id,
      details: {
        userId,
        courseId,
        tenantId,
        templateId: template?.id ?? null,
        templateScope: template?.scopeType ?? 'none',
        source: opts.source,
        certificateNumber: certNumber,
        pdfStorageKey: artifact.pdfStorageKey,
      },
      ip: opts.ip,
      userAgent: opts.userAgent,
      tenantId,
    });

    if (!artifact.pdfStorageKey) {
      this.logger.warn(
        `Certificate ${certNumber} issued without a stored PDF ` +
          `(storage configured: ${this.storage?.isConfigured ?? false}); ` +
          `it can be regenerated on demand from the payload snapshot.`,
      );
    }

    void this.notifyLearnerCertificateIssued(userId, courseId, tenantId, cert);

    return cert;
  }

  /**
   * Automatic issuance on course completion. Idempotent and tenant-safe.
   *
   * Returns a structured result rather than a bare row|null, because the two
   * callers are completion handlers that must not throw, while the Studio needs
   * to explain *why* a course has no certificate. A "no template" answer is
   * reported as `skipped`, not silently swallowed.
   */
  async tryAutoIssue(
    userId: string,
    courseId: string,
    tenantId: string,
    opts?: { ip?: string; userAgent?: string },
  ): Promise<{
    certificate: typeof certifications.$inferSelect | null;
    status: 'issued' | 'existing' | 'skipped';
    reason?: 'disabled' | 'no-template';
    templateScope?: string;
  }> {
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
    });
    if (!course) throw new NotFoundException('Course not found');

    const completeEnrollment = async () => {
      await this.drizzle.db
        .update(enrollments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(
          and(
            eq(enrollments.userId, userId),
            eq(enrollments.courseId, courseId),
            eq(enrollments.tenantId, tenantId),
          ),
        );
    };

    if (course.autoIssueCertificate === false) {
      this.logger.log(`Auto-issue skipped: disabled for course=${courseId}`);
      // The learner still finished the course; only the certificate is withheld.
      await completeEnrollment();
      return { certificate: null, status: 'skipped', reason: 'disabled' };
    }

    const existing = await this.drizzle.db.query.certifications.findFirst({
      where: and(
        eq(certifications.userId, userId),
        eq(certifications.courseId, courseId),
        sql`${certifications.revokedAt} IS NULL`,
      ),
    });
    if (existing) {
      return { certificate: existing as typeof certifications.$inferSelect, status: 'existing' };
    }

    const { template, matchedBy } = await this.resolveTemplateForCourse(tenantId, courseId);
    if (!template) {
      this.logger.warn(
        `Auto-issue skipped: no active template at any scope for tenant=${tenantId} course=${courseId}`,
      );
      await completeEnrollment();
      return { certificate: null, status: 'skipped', reason: 'no-template' };
    }

    try {
      const cert = await this.issueInternal(tenantId, userId, courseId, {
        templateId: template.id,
        source: 'automatic',
        actorId: userId,
        ip: opts?.ip,
        userAgent: opts?.userAgent,
      });
      return { certificate: cert, status: 'issued', templateScope: matchedBy };
    } catch (e: any) {
      // Two completion handlers can fire for the same final lesson. The partial
      // unique index rejects the loser, so re-read and treat it as a success.
      if (String(e?.message)?.includes('unique') || String(e?.code) === '23505') {
        const again = await this.drizzle.db.query.certifications.findFirst({
          where: and(
            eq(certifications.userId, userId),
            eq(certifications.courseId, courseId),
            sql`${certifications.revokedAt} IS NULL`,
          ),
        });
        if (again) {
          return {
            certificate: again as typeof certifications.$inferSelect,
            status: 'existing',
            templateScope: matchedBy,
          };
        }
      }
      throw e;
    }
  }

  // --- Templates (admin) ---

  async listTemplates(
    tenantId: string,
    opts: {
      q?: string;
      isActive?: string;
      courseId?: string;
      academyId?: string;
      scopeType?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const conditions: any[] = [eq(certTemplates.tenantId, tenantId)];
    if (opts.q) {
      const pattern = `%${opts.q}%`;
      conditions.push(ilike(certTemplates.name, pattern));
    }
    if (opts.isActive === 'true') conditions.push(eq(certTemplates.isActive, true));
    if (opts.isActive === 'false') conditions.push(eq(certTemplates.isActive, false));
    // The controller has always offered ?courseId= but nothing consumed it, so
    // the filter silently returned the unfiltered list.
    if (opts.courseId) conditions.push(eq(certTemplates.courseId, opts.courseId));
    if (opts.academyId) conditions.push(eq(certTemplates.academyId, opts.academyId));
    if (opts.scopeType) conditions.push(eq(certTemplates.scopeType, opts.scopeType));

    const where = and(...conditions);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

    const rows = await this.drizzle.db
      .select()
      .from(certTemplates)
      .where(where)
      .orderBy(desc(certTemplates.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const totalArr = await this.drizzle.db.select({ count: count() }).from(certTemplates).where(where);
    return { items: rows, total: Number(totalArr[0]?.count ?? 0), page, limit };
  }

  async getTemplate(tenantId: string, id: string) {
    const tpl = await this.drizzle.db.query.certTemplates.findFirst({
      where: and(eq(certTemplates.id, id), eq(certTemplates.tenantId, tenantId)),
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  /**
   * Validate and normalise a template's assignment.
   *
   * The database CHECK constraint is the last line of defence, but a constraint
   * violation surfaces as a raw 500. Validating here means an admin gets a
   * message that names the field to fix.
   *
   * Also resolves the scope from whichever id was supplied, so a client that
   * sends only `courseId` (the pre-existing Studio behaviour) still gets a
   * correctly scoped template instead of being silently stored as a default.
   */
  private async normaliseTemplateScope(
    tenantId: string,
    data: { scopeType?: string; courseId?: string | null; academyId?: string | null },
    current?: TemplateRow | null,
  ): Promise<{ scopeType: string; courseId: string | null; academyId: string | null }> {
    const courseId = data.courseId !== undefined ? (data.courseId || null) : (current?.courseId ?? null);
    const academyId = data.academyId !== undefined ? (data.academyId || null) : (current?.academyId ?? null);

    // Infer scope from the ids when the client did not state one.
    const inferred =
      data.scopeType ||
      (courseId ? 'course' : academyId ? 'academy' : 'tenant');
    const scopeType = ['course', 'academy', 'tenant'].includes(inferred) ? inferred : 'tenant';

    if (scopeType === 'course') {
      if (!courseId) throw new BadRequestException('A course-scoped template needs a courseId');
      if (academyId) throw new BadRequestException('A course-scoped template must not have an academyId');
      const course = await this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
        columns: { id: true },
      });
      if (!course) throw new NotFoundException('Course not found in this tenant');
      return { scopeType, courseId, academyId: null };
    }

    if (scopeType === 'academy') {
      if (!academyId) throw new BadRequestException('An academy-scoped template needs an academyId');
      if (courseId) throw new BadRequestException('An academy-scoped template must not have a courseId');
      const academy = await this.drizzle.db.query.academies.findFirst({
        where: and(eq(academies.id, academyId), eq(academies.tenantId, tenantId)),
        columns: { id: true },
      });
      if (!academy) throw new NotFoundException('Academy not found in this tenant');
      return { scopeType, courseId: null, academyId };
    }

    return { scopeType: 'tenant', courseId: null, academyId: null };
  }

  async createTemplate(tenantId: string, actorId: string, data: any, ip?: string, userAgent?: string) {
    const scope = await this.normaliseTemplateScope(tenantId, data ?? {});
    const [tpl] = await this.drizzle.db
      .insert(certTemplates)
      .values({
        tenantId,
        scopeType: scope.scopeType,
        courseId: scope.courseId,
        academyId: scope.academyId,
        name: data.name,
        layout: data.layout || 'modern',
        primaryColor: data.primaryColor || '#7c3aed',
        secondaryColor: data.secondaryColor || '#0a1628',
        logoUrl: data.logoUrl || null,
        backgroundUrl: data.backgroundUrl || null,
        fontFamily: data.fontFamily || 'Inter',
        fields: data.fields ?? [],
        isActive: data.isActive !== false,
      })
      .returning();
    if (!tpl) throw new Error('Failed to create template');
    await this.audit.log({
      userId: actorId,
      action: 'certificates:template_create',
      entityType: 'cert_template',
      entityId: tpl.id,
      details: { name: tpl.name, tenantId },
      ip,
      userAgent,
      tenantId,
    });
    return tpl;
  }

  async updateTemplate(tenantId: string, id: string, actorId: string, data: any, ip?: string, userAgent?: string) {
    const existing = await this.drizzle.db.query.certTemplates.findFirst({
      where: and(eq(certTemplates.id, id), eq(certTemplates.tenantId, tenantId)),
    });
    if (!existing) throw new NotFoundException('Template not found');
    const scope = await this.normaliseTemplateScope(tenantId, data ?? {}, existing as TemplateRow);
    const [updated] = await this.drizzle.db
      .update(certTemplates)
      .set({
        scopeType: scope.scopeType,
        courseId: scope.courseId,
        academyId: scope.academyId,
        name: data.name ?? existing.name,
        layout: data.layout ?? existing.layout,
        primaryColor: data.primaryColor ?? existing.primaryColor,
        secondaryColor: data.secondaryColor ?? existing.secondaryColor,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl,
        backgroundUrl: data.backgroundUrl !== undefined ? data.backgroundUrl : existing.backgroundUrl,
        fontFamily: data.fontFamily ?? existing.fontFamily,
        fields: data.fields ?? existing.fields,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(certTemplates.id, id), eq(certTemplates.tenantId, tenantId)))
      .returning();
    await this.audit.log({
      userId: actorId,
      action: 'certificates:template_update',
      entityType: 'cert_template',
      entityId: id,
      details: { changes: Object.keys(data), tenantId },
      ip,
      userAgent,
      tenantId,
    });
    return updated;
  }

  async manualIssue(
    tenantId: string,
    actorId: string,
    data: { userId: string; courseId: string; templateId?: string; expiresAt?: string },
    ip?: string,
    userAgent?: string,
  ) {
    const [user, course] = await Promise.all([
      this.drizzle.db.query.users.findFirst({
        where: and(eq(users.id, data.userId), eq(users.tenantId, tenantId)),
      }),
      this.drizzle.db.query.courses.findFirst({
        where: and(eq(courses.id, data.courseId), eq(courses.tenantId, tenantId)),
      }),
    ]);
    if (!user) throw new NotFoundException('Learner not found in this tenant');
    if (!course) throw new NotFoundException('Course not found in this tenant');

    // Recorded for the admin UI, not enforced: issuing for a learner who has
    // not finished is a deliberate override, and the audit trail should say so.
    const enrollment = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, data.userId), eq(enrollments.courseId, data.courseId)),
    });
    const existing = await this.drizzle.db.query.certifications.findFirst({
      where: and(
        eq(certifications.userId, data.userId),
        eq(certifications.courseId, data.courseId),
        sql`${certifications.revokedAt} IS NULL`,
      ),
    });
    if (existing) {
      throw new BadRequestException('Learner already has an active certificate for this course');
    }

    const cert = await this.issueInternal(tenantId, data.userId, data.courseId, {
      source: 'manual',
      actorId,
      templateId: data.templateId ?? null,
      expiresAt: data.expiresAt ?? null,
      ip,
      userAgent,
      extraMetadata: {
        enrollmentMissing: !enrollment,
        enrollmentCompleted: enrollment?.status === 'completed',
      },
    });
    return cert;
  }
}
