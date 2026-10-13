import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { partnerApplications, PARTNER_APPLICATION_TYPES } from '../../database/schema/partner-applications';
import { auditLogs } from '../../database/schema/auth';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '../../config/config.service';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sanitize(v: unknown): string {
  return String(v ?? '').replace(/[<>]/g, '').trim();
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['under_review', 'approved', 'rejected', 'needs_info'],
  under_review: ['approved', 'rejected', 'needs_info', 'pending'],
  needs_info: ['pending', 'under_review', 'approved', 'rejected'],
  approved: ['approved'],
  rejected: ['rejected', 'pending'],
};

@Injectable()
export class PartnersService {
  constructor(
    private drizzle: DrizzleService,
    private email: EmailService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  async create(input: any, tenantId: string, userId: string | null) {
    // honeypot
    if (input.botField) throw new BadRequestException('Bot detected');

    const type = input.type as string;
    if (!PARTNER_APPLICATION_TYPES.includes(type as any)) throw new BadRequestException('Invalid type');
    const companyName = sanitize(input.companyName);
    const contactName = sanitize(input.contactName);
    const email = String(input.email ?? '').trim().toLowerCase();
    const message = sanitize(input.message);
    if (companyName.length < 2) throw new BadRequestException('Company name is too short');
    if (contactName.length < 2) throw new BadRequestException('Contact name is too short');
    if (!EMAIL.test(email)) throw new BadRequestException('Invalid email');
    if (message.length < 10) throw new BadRequestException('Message is too short');

    const website = input.website ? sanitize(input.website) : null;
    const phone = input.phone ? sanitize(input.phone) : null;
    const country = input.country ? sanitize(input.country) : null;
    const city = input.city ? sanitize(input.city) : null;
    const audienceSize = input.audienceSize ? sanitize(input.audienceSize) : null;

    // duplicate open application
    const openStatuses = ['pending', 'under_review', 'needs_info'];
    const existing = await this.drizzle.db
      .select({ id: partnerApplications.id, status: partnerApplications.status })
      .from(partnerApplications)
      .where(
        and(
          eq(partnerApplications.tenantId, tenantId),
          eq(partnerApplications.email, email),
          sql`${partnerApplications.status} = ANY(${openStatuses})`,
        ),
      )
      .limit(1);
    if (existing.length) {
      throw new ConflictException('You already have an open partner application. We will be in touch.');
    }

    const [app] = await this.drizzle.db
      .insert(partnerApplications)
      .values({
        tenantId,
        userId: userId ?? null,
        type: type as any,
        companyName,
        website,
        contactName,
        email,
        phone,
        country,
        city,
        message,
        socialLinks: input.socialLinks ?? {},
        audienceSize,
        source: input.source ?? {},
        status: 'pending',
      })
      .returning();

    if (!app) throw new BadRequestException('Could not create application');

    // notify admin
    try {
      await this.notifications.notifyTenantAdmins(tenantId, {
        type: 'partner.application.submitted',
        category: 'partners',
        title: 'New partner application',
        body: `${companyName} (${contactName}) applied as ${type}`,
        email: true,
        href: `/admin/partners/${app.id}`,
        entityType: 'partner_application',
        entityId: app.id,
      });
    } catch {
      // swallow
    }

    // applicant email
    try {
      const fe = this.config.get('FRONTEND_URL');
      await this.email.send({
        to: email,
        subject: 'We received your partner application',
        html: `<p>Hi ${contactName},</p><p>Thanks for applying. Your reference is <strong>${app.id}</strong>.</p><p>We will review it and get back to you.</p><p><a href="${fe}/become-a-partner">View</a></p>`,
        text: `Hi ${contactName},\n\nThanks for applying. Your reference: ${app.id}\nWe will review and get back to you.`,
      });
    } catch {}

    return app;
  }

  async getForUser(userId: string, tenantId: string) {
    return this.drizzle.db
      .select()
      .from(partnerApplications)
      .where(and(eq(partnerApplications.userId, userId), eq(partnerApplications.tenantId, tenantId)))
      .orderBy(desc(partnerApplications.createdAt));
  }

  async listForAdmin(tenantId: string, opts: any) {
    const filters = [eq(partnerApplications.tenantId, tenantId), sql`${partnerApplications.deletedAt} is null`];
    if (opts.status && opts.status !== 'all') filters.push(eq(partnerApplications.status, opts.status));
    if (opts.type && opts.type !== 'all') filters.push(eq(partnerApplications.type, opts.type));
    if (opts.q) {
      const term = `%${opts.q}%`;
      filters.push(or(ilike(partnerApplications.companyName, term), ilike(partnerApplications.contactName, term), ilike(partnerApplications.email, term))!);
    }
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const offset = (page - 1) * limit;
    const rows = await this.drizzle.db.select().from(partnerApplications).where(and(...filters)).orderBy(desc(partnerApplications.createdAt)).limit(limit).offset(offset);
    const countRows = await this.drizzle.db.select({ count: sql<number>`count(*)::int` }).from(partnerApplications).where(and(...filters));
    return { items: rows, total: countRows[0]?.count ?? 0, page, limit };
  }

  async getDetail(tenantId: string, id: string) {
    const rows = await this.drizzle.db.select().from(partnerApplications).where(and(eq(partnerApplications.id, id), eq(partnerApplications.tenantId, tenantId))).limit(1);
    if (!rows[0]) throw new NotFoundException('Application not found');
    return rows[0];
  }

  async updateStatus(tenantId: string, id: string, input: any, reviewerId: string) {
    const app = await this.getDetail(tenantId, id);
    const nextStatus = input.status ?? app.status;
    if (nextStatus !== app.status) {
      const allowed = VALID_TRANSITIONS[app.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(`Cannot transition from ${app.status} to ${nextStatus}`);
      }
    }

    const updateData: any = {
      status: nextStatus,
      adminNotes: input.adminNotes !== undefined ? input.adminNotes : app.adminNotes,
      rejectionReason: input.rejectionReason !== undefined ? input.rejectionReason : app.rejectionReason,
      infoRequestMessage: input.infoRequestMessage !== undefined ? input.infoRequestMessage : app.infoRequestMessage,
      updatedAt: new Date(),
    };

    if (nextStatus !== app.status && (nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'needs_info')) {
      updateData.reviewedAt = new Date();
      updateData.reviewerId = reviewerId;
    }

    const [updated] = await this.drizzle.db.update(partnerApplications).set(updateData).where(and(eq(partnerApplications.id, id), eq(partnerApplications.tenantId, tenantId))).returning();
    if (!updated) throw new NotFoundException('Application not found');

    // audit log
    try {
      await this.drizzle.db.insert(auditLogs).values({
        tenantId,
        userId: reviewerId,
        action: 'partner.application.status_changed',
        targetType: 'partner_application',
        targetId: id,
        metadata: { from: app.status, to: nextStatus },
      } as any);
    } catch {}

    // emails
    await this.sendStatusEmail(updated, nextStatus, app.status);

    return updated;
  }

  async approve(tenantId: string, id: string, reviewerId: string, notes?: string) {
    return this.updateStatus(tenantId, id, { status: 'approved', adminNotes: notes }, reviewerId);
  }
  async reject(tenantId: string, id: string, reviewerId: string, reason: string, notes?: string) {
    return this.updateStatus(tenantId, id, { status: 'rejected', rejectionReason: reason, adminNotes: notes }, reviewerId);
  }
  async requestInfo(tenantId: string, id: string, reviewerId: string, message: string, notes?: string) {
    return this.updateStatus(tenantId, id, { status: 'needs_info', infoRequestMessage: message, adminNotes: notes }, reviewerId);
  }

  private async sendStatusEmail(app: any, newStatus: string, oldStatus: string) {
    if (newStatus === oldStatus) return;
    const fe = this.config.get('FRONTEND_URL');

    if (newStatus === 'approved') {
      await this.email.send({
        to: app.email,
        subject: 'Your partner application was approved',
        html: `<p>Hi ${app.contactName},</p><p>Great news — your application for <strong>${app.companyName}</strong> has been approved.</p><p>We'll follow up with next steps.</p>`,
        text: `Hi ${app.contactName},\n\nYour application for ${app.companyName} has been approved. We'll follow up with next steps.`,
      });
    } else if (newStatus === 'rejected') {
      await this.email.send({
        to: app.email,
        subject: 'Update on your partner application',
        html: `<p>Hi ${app.contactName},</p><p>Thank you for applying. Unfortunately we won't be moving forward at this time.</p>${app.rejectionReason ? `<p>Reason: ${app.rejectionReason}</p>` : ''}`,
        text: `Hi ${app.contactName},\n\nThank you for applying. Unfortunately we won't be moving forward at this time.${app.rejectionReason ? `\nReason: ${app.rejectionReason}` : ''}`,
      });
    } else if (newStatus === 'needs_info') {
      await this.email.send({
        to: app.email,
        subject: 'We need a bit more information',
        html: `<p>Hi ${app.contactName},</p><p>We're reviewing your application and need a bit more info:</p><p>${app.infoRequestMessage ?? ''}</p><p>You can reply to this email.</p>`,
        text: `Hi ${app.contactName},\n\nWe need a bit more info:\n${app.infoRequestMessage ?? ''}`,
      });
    }
    // admin notification for status change not needed
    void fe;
  }
}
