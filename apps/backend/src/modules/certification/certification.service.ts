import { Injectable, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { certifications, certTemplates } from '../../database/schema/certifications';
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

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private drizzle: DrizzleService,
    private audit: AuditService,
    @Optional() private notifications?: NotificationsService,
    @Optional() private emailService?: EmailService,
  ) {}

  async findByUser(userId: string) {
    return this.drizzle.db.query.certifications.findMany({
      where: eq(certifications.userId, userId),
      with: { course: { columns: { title: true, slug: true } } },
    });
  }

  async verify(certificateNumber: string) {
    const cert = await this.drizzle.db.query.certifications.findFirst({
      where: eq(certifications.certificateNumber, certificateNumber),
      with: {
        user: { columns: { name: true, email: true } },
        course: { columns: { title: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  async issue(userId: string, courseId: string, tenantId: string) {
    const existing = await this.drizzle.db.query.certifications.findFirst({
      where: and(
        eq(certifications.userId, userId),
        eq(certifications.courseId, courseId),
        sql`${certifications.revokedAt} IS NULL`,
      ),
    });
    if (existing) return existing;

    const seq = Date.now() % 1000000;
    const certNumber = generateCertificateNumber('TMF', new Date().getFullYear(), seq);

    const signature = crypto
      .createHash('sha256')
      .update(`${certNumber}:${userId}:${courseId}:${tenantId}`)
      .digest('hex');

    const [cert] = await this.drizzle.db
      .insert(certifications)
      .values({
        tenantId,
        userId,
        courseId,
        certificateNumber: certNumber,
        digitalSignature: signature,
        metadata: { issuedAt: new Date().toISOString(), source: 'manual' },
      })
      .returning();
    if (!cert) throw new Error('Failed to create certificate');

    await this.drizzle.db
      .update(enrollments)
      .set({ status: 'completed', completedAt: new Date(), certificateId: cert.id })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

    await this.audit.log({
      userId,
      action: 'certificates:issue',
      entityType: 'certification',
      entityId: cert.id,
      details: { userId, courseId, tenantId, certificateNumber: cert.certificateNumber },
      tenantId,
    });

    return cert;
  }

  // --- Admin management surface ---

  async findForAdmin(
    tenantId: string,
    opts: {
      q?: string; courseId?: string; userId?: string; status?: string;
      from?: string; to?: string; page?: number; limit?: number;
    },
  ) {
    const conditions: any[] = [eq(certifications.tenantId, tenantId)];
    if (opts.courseId) conditions.push(eq(certifications.courseId, opts.courseId));
    if (opts.userId) conditions.push(eq(certifications.userId, opts.userId));
    if (opts.from) conditions.push(gte(certifications.issuedAt, new Date(opts.from)));
    if (opts.to) conditions.push(lte(certifications.issuedAt, new Date(`${opts.to}T23:59:59.999Z`)));
    if (opts.status === 'revoked') conditions.push(sql`${certifications.revokedAt} IS NOT NULL`);
    else if (opts.status === 'active') {
      conditions.push(
        and(
          sql`${certifications.revokedAt} IS NULL`,
          or(sql`${certifications.expiresAt} IS NULL`, gte(certifications.expiresAt, new Date())),
        ),
      );
    } else if (opts.status === 'expired') {
      conditions.push(and(lte(certifications.expiresAt, new Date()), sql`${certifications.revokedAt} IS NULL`));
    }
    if (opts.q) {
      const pattern = `%${opts.q}%`;
      conditions.push(
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

    const totalArr = await this.drizzle.db.select({ count: count() }).from(certifications).innerJoin(users, eq(certifications.userId, users.id)).innerJoin(courses, eq(certifications.courseId, courses.id)).where(where);

    return { items: rows, total: Number(totalArr[0]?.count ?? 0), page, limit };
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

  private async findActiveTemplateForCourse(tenantId: string, courseId: string) {
    const courseSpecific = await this.drizzle.db.query.certTemplates.findFirst({
      where: and(eq(certTemplates.tenantId, tenantId), eq(certTemplates.courseId, courseId), eq(certTemplates.isActive, true)),
      orderBy: [desc(certTemplates.createdAt)],
    });
    if (courseSpecific) return courseSpecific;
    return this.drizzle.db.query.certTemplates.findFirst({
      where: and(eq(certTemplates.tenantId, tenantId), isNull(certTemplates.courseId), eq(certTemplates.isActive, true)),
      orderBy: [desc(certTemplates.createdAt)],
    });
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
   * Shared issuance core with template resolution and source tracking.
   * Returns existing active cert if present (idempotent).
   */
  private async issueInternal(
    tenantId: string,
    userId: string,
    courseId: string,
    opts: { templateId?: string | null; source: string; actorId?: string; expiresAt?: string | null; ip?: string; userAgent?: string },
  ) {
    const activeExisting = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.userId, userId), eq(certifications.courseId, courseId), sql`${certifications.revokedAt} IS NULL`),
    });
    if (activeExisting) return activeExisting as typeof certifications.$inferSelect;

    let templateId = opts.templateId ?? null;
    if (opts.source === 'automatic' && !templateId) {
      const tpl = await this.findActiveTemplateForCourse(tenantId, courseId);
      templateId = tpl?.id ?? null;
    }

    if (opts.templateId) {
      const tpl = await this.drizzle.db.query.certTemplates.findFirst({
        where: and(eq(certTemplates.id, opts.templateId), eq(certTemplates.tenantId, tenantId)),
      });
      if (!tpl) throw new NotFoundException('Template not found');
      if (!tpl.isActive) throw new BadRequestException('Template is inactive');
    }

    const seq = Date.now() % 1000000;
    const certNumber = generateCertificateNumber('TMF', new Date().getFullYear(), seq);
    const signature = crypto.createHash('sha256').update(`${certNumber}:${userId}:${courseId}:${tenantId}`).digest('hex');

    const [cert] = await this.drizzle.db
      .insert(certifications)
      .values({
        tenantId,
        userId,
        courseId,
        templateId,
        certificateNumber: certNumber,
        digitalSignature: signature,
        expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
        metadata: { issuedAt: new Date().toISOString(), source: opts.source, issuedBy: opts.actorId ?? userId },
      })
      .returning();
    if (!cert) throw new Error('Failed to create certificate');

    await this.drizzle.db
      .update(enrollments)
      .set({ status: 'completed', completedAt: new Date(), certificateId: cert.id })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));

    await this.audit.log({
      userId: opts.actorId ?? userId,
      action: 'certificates:issue',
      entityType: 'certification',
      entityId: cert.id,
      details: { userId, courseId, tenantId, templateId, source: opts.source, certificateNumber: cert.certificateNumber },
      ip: opts.ip,
      userAgent: opts.userAgent,
      tenantId,
    });

    // Fire-and-forget notification
    void this.notifyLearnerCertificateIssued(userId, courseId, tenantId, cert);

    return cert;
  }

  /**
   * Automatic issuance on course completion. Idempotent, tenant-safe.
   * Returns cert if created or existing, or null if skipped (no template).
   */
  async tryAutoIssue(
    userId: string,
    courseId: string,
    tenantId: string,
    opts?: { ip?: string; userAgent?: string },
  ): Promise<typeof certifications.$inferSelect | null> {
    // Course-level toggle
    const course = await this.drizzle.db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)),
    });
    if (!course) throw new NotFoundException('Course not found');
    if ((course as any).autoIssueCertificate === false) {
      this.logger.log(`Auto-issue skipped: disabled for course=${courseId}`);
      await this.drizzle.db
        .update(enrollments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), eq(enrollments.tenantId, tenantId)));
      return null;
    }

    // Idempotent: active cert already exists
    const existing = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.userId, userId), eq(certifications.courseId, courseId), sql`${certifications.revokedAt} IS NULL`),
    });
    if (existing) return existing as typeof certifications.$inferSelect;

    const tpl = await this.findActiveTemplateForCourse(tenantId, courseId);
    if (!tpl) {
      this.logger.warn(`Auto-issue skipped: no active template for tenant=${tenantId} course=${courseId}`);
      // Still mark enrollment completed per decision 2
      await this.drizzle.db
        .update(enrollments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), eq(enrollments.tenantId, tenantId)));
      return null;
    }

    try {
      return await this.issueInternal(tenantId, userId, courseId, {
        templateId: tpl.id,
        source: 'automatic',
        actorId: userId,
        ip: opts?.ip,
        userAgent: opts?.userAgent,
      });
    } catch (e: any) {
      // Unique violation race — fetch existing
      if (String(e?.message)?.includes('unique') || String(e?.code) === '23505') {
        const again = await this.drizzle.db.query.certifications.findFirst({
          where: and(eq(certifications.userId, userId), eq(certifications.courseId, courseId), sql`${certifications.revokedAt} IS NULL`),
        });
        if (again) return again as typeof certifications.$inferSelect;
      }
      throw e;
    }
  }

  // --- Templates (admin) ---

  async listTemplates(
    tenantId: string,
    opts: { q?: string; isActive?: string; page?: number; limit?: number },
  ) {
    const conditions: any[] = [eq(certTemplates.tenantId, tenantId)];
    if (opts.q) {
      const pattern = `%${opts.q}%`;
      conditions.push(ilike(certTemplates.name, pattern));
    }
    if (opts.isActive === 'true') conditions.push(eq(certTemplates.isActive, true));
    if (opts.isActive === 'false') conditions.push(eq(certTemplates.isActive, false));

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

  async createTemplate(tenantId: string, actorId: string, data: any, ip?: string, userAgent?: string) {
    const [tpl] = await this.drizzle.db
      .insert(certTemplates)
      .values({
        tenantId,
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
    const [updated] = await this.drizzle.db
      .update(certTemplates)
      .set({
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
      this.drizzle.db.query.users.findFirst({ where: and(eq(users.id, data.userId), eq(users.tenantId, tenantId)) }),
      this.drizzle.db.query.courses.findFirst({ where: and(eq(courses.id, data.courseId), eq(courses.tenantId, tenantId)) }),
    ]);
    if (!user) throw new NotFoundException('Learner not found in this tenant');
    if (!course) throw new NotFoundException('Course not found in this tenant');
    if (data.templateId) {
      const tpl = await this.drizzle.db.query.certTemplates.findFirst({
        where: and(eq(certTemplates.id, data.templateId), eq(certTemplates.tenantId, tenantId)),
      });
      if (!tpl) throw new NotFoundException('Template not found');
      if (!tpl.isActive) throw new BadRequestException('Template is inactive');
    }

    // Warn if no enrollment/completion but allow (frontend shows warning)
    const enrollment = await this.drizzle.db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, data.userId), eq(enrollments.courseId, data.courseId)),
    });

    const existing = await this.drizzle.db.query.certifications.findFirst({
      where: and(eq(certifications.userId, data.userId), eq(certifications.courseId, data.courseId)),
    });
    if (existing && !existing.revokedAt) {
      throw new BadRequestException('Learner already has an active certificate for this course');
    }

    const seq = Date.now() % 1000000;
    const certNumber = generateCertificateNumber('TMF', new Date().getFullYear(), seq);
    const signature = crypto
      .createHash('sha256')
      .update(`${certNumber}:${data.userId}:${data.courseId}:${tenantId}`)
      .digest('hex');

    const [cert] = await this.drizzle.db
      .insert(certifications)
      .values({
        tenantId,
        userId: data.userId,
        courseId: data.courseId,
        templateId: data.templateId || null,
        certificateNumber: certNumber,
        digitalSignature: signature,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        metadata: {
          issuedAt: new Date().toISOString(),
          issuedBy: actorId,
          source: 'manual',
          enrollmentMissing: !enrollment,
          enrollmentCompleted: enrollment?.status === 'completed',
        },
      })
      .returning();
    if (!cert) throw new Error('Failed to create certificate');

    if (enrollment) {
      await this.drizzle.db
        .update(enrollments)
        .set({ status: 'completed', completedAt: new Date(), certificateId: cert.id })
        .where(and(eq(enrollments.userId, data.userId), eq(enrollments.courseId, data.courseId)));
    }

    await this.audit.log({
      userId: actorId,
      action: 'certificates:issue',
      entityType: 'certification',
      entityId: cert.id,
      details: { userId: data.userId, courseId: data.courseId, templateId: data.templateId, tenantId, enrollmentMissing: !enrollment, source: 'manual' },
      ip,
      userAgent,
      tenantId,
    });

    void this.notifyLearnerCertificateIssued(data.userId, data.courseId, tenantId, cert);

    return cert;
  }
}
