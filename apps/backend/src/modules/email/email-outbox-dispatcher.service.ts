import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { emailOutbox, emailTemplates } from '../../database/schema/emails';
import { EmailProvider } from './email.provider';
import { EmailTemplatesService } from './email-templates.service';
import { getTrigger } from './trigger.registry';

/** How many rows one tick claims. Resend allows ~10 req/s; 20 per 5s is far under. */
const BATCH_SIZE = 20;
/** Attempts before a row is terminal. 5 spreads to roughly 8 hours. */
const MAX_ATTEMPTS = 5;

/**
 * Backoff in minutes per attempt: ~1m, 5m, 15m, 1h, then dead.
 * A retry budget measured in hours matters because most retryable failures
 * (an unverified domain, a bad API key) are configuration, and no amount of
 * retrying fixes them.
 */
const BACKOFF_MINUTES = [1, 5, 15, 60];

@Injectable()
export class EmailOutboxDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(EmailOutboxDispatcherService.name);
  /** Guards against overlapping ticks when a send is slow. */
  private draining = false;
  private enabled = true;
  /** Surfaced in /health so a stalled drainer is visible rather than silent. */
  lastRunAt: Date | null = null;
  lastError: string | null = null;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly provider: EmailProvider,
    private readonly templates: EmailTemplatesService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') this.enabled = false;
  }

  health() {
    return {
      enabled: this.enabled,
      providerConfigured: this.provider.isConfigured,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
    };
  }

  /**
   * Claim a batch atomically.
   *
   * `FOR UPDATE SKIP LOCKED` is what makes this safe to run on multiple replicas
   * with no coordination: each replica locks a disjoint set of rows and skips
   * the ones another is already holding, so no send is ever attempted twice by
   * two workers.
   *
   * The claim sets `sending` in the same statement as the SELECT, so there is no
   * window in which a row is selected by two workers.
   */
  private async claimBatch() {
    return this.drizzle.db
      .update(emailOutbox)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(
        inArray(
          emailOutbox.id,
          sql`
            (SELECT id FROM email_outbox
              WHERE status = 'queued' AND scheduled_for <= now()
              ORDER BY scheduled_for
              LIMIT ${BATCH_SIZE}
              FOR UPDATE SKIP LOCKED)
          `,
        ),
      )
      .returning();
  }

  @Cron('*/5 * * * * *')
  async drain(): Promise<void> {
    if (!this.enabled || this.draining) return;
    this.draining = true;
    try {
      const batch = await this.claimBatch();
      if (batch.length === 0) return;
      this.logger.log(`Draining ${batch.length} queued email(s)`);

      // Sequential, not Promise.all: it keeps us inside the provider's rate
      // limit and makes the log readable in order.
      for (const row of batch) {
        await this.process(row);
      }
      this.lastRunAt = new Date();
      this.lastError = null;
    } catch (error: any) {
      this.lastError = error?.message ?? String(error);
      this.logger.error(`Outbox drain failed: ${this.lastError}`);
    } finally {
      this.draining = false;
    }
  }

  private async process(row: typeof emailOutbox.$inferSelect): Promise<void> {
    let rendered;
    try {
      rendered = await this.renderFromRow(row);
    } catch (error: any) {
      await this.markDead(row, 'render_error', error?.message ?? 'render failed');
      return;
    }

    if (!rendered) {
      await this.markDead(row, 'no_template', 'Template is missing or archived');
      return;
    }

    if (this.provider.isConfigured) {
      const result = await this.provider.send({
        to: row.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: row.replyTo,
      });

      if (result.ok) {
        await this.markSent(row, result.providerId);
        return;
      }

      // Distinguish "try again later" from "this will never work". Retrying a
      // 403 unverified-domain five times just buries the operator's signal.
      const canRetry = result.retryable && row.attempts < MAX_ATTEMPTS;
      if (canRetry) {
        const delay = BACKOFF_MINUTES[Math.min(Math.max(row.attempts - 1, 0), BACKOFF_MINUTES.length - 1)] ?? 15;
        await this.markRetry(row, result.code, result.message, delay);
        return;
      }
      await this.markDead(row, result.code, result.message);
      return;
    }

    // No provider: nothing was sent. Park rather than loop, so a misconfigured
    // deployment cannot spin through its whole queue burning attempt budget.
    await this.markRetry(row, 'provider_not_configured', 'RESEND_API_KEY is not set', 15);
  }

  /**
   * Re-render from the STORED payload, not from live data. A receipt sent six
   * hours after a retry must still show the total charged at payment time, so
   * the outbox row carries the payload it was enqueued with.
   */
  private async renderFromRow(row: typeof emailOutbox.$inferSelect) {
    if (!row.templateId) return null;
    const [template] = await this.drizzle.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, row.templateId))
      .limit(1);
    if (!template || template.status === 'archived') return null;

    const brand = await this.templates.brandFor(row.tenantId);
    return this.templates.renderForTrigger(
      template.layout,
      getTrigger(row.triggerKey),
      row.payload,
      row.subject,
      template.preheaderTemplate ?? null,
      {
        fromAddress: row.fromAddress,
        supportEmail: brand.supportEmail,
        replyTo: row.replyTo,
        unsubscribeUrlPath: null,
        utm: null,
      },
    );
  }

  private async markSent(row: typeof emailOutbox.$inferSelect, providerId: string | null) {
    await this.drizzle.db
      .update(emailOutbox)
      .set({
        status: 'sent',
        providerId,
        sentAt: new Date(),
        attempts: row.attempts + 1,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, row.id));
  }

  private async markRetry(
    row: typeof emailOutbox.$inferSelect,
    code: string,
    message: string,
    delayMinutes: number,
  ) {
    await this.drizzle.db
      .update(emailOutbox)
      .set({
        status: 'queued',
        attempts: row.attempts + 1,
        lastErrorCode: code.slice(0, 60),
        lastErrorMessage: String(message).slice(0, 500),
        scheduledFor: new Date(Date.now() + delayMinutes * 60_000),
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, row.id));
    this.logger.warn(
      `Email ${row.id} failed (${code}); retry ${row.attempts + 1}/${MAX_ATTEMPTS} in ${delayMinutes}m`,
    );
  }

  /**
   * Terminal failures are retained, never deleted. A `dead` row is a pending bug
   * that must stay visible in the send log with the reason attached.
   */
  private async markDead(
    row: typeof emailOutbox.$inferSelect,
    code: string,
    message: string,
  ) {
    await this.drizzle.db
      .update(emailOutbox)
      .set({
        status: 'dead',
        attempts: row.attempts + 1,
        lastErrorCode: code.slice(0, 60),
        lastErrorMessage: String(message).slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, row.id));
    this.logger.error(`Email ${row.id} is dead (${code}): ${message}`);
  }

  /** Admin "Retry" action: puts a dead row back on the queue. */
  async requeue(id: string, tenantId: string): Promise<void> {
    const [row] = await this.drizzle.db
      .select()
      .from(emailOutbox)
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new Error('Email not found');
    await this.drizzle.db
      .update(emailOutbox)
      .set({
        status: 'queued',
        attempts: 0,
        scheduledFor: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, id));
  }

  async countsByStatus(tenantId: string) {
    const rows = await this.drizzle.db
      .select({ status: emailOutbox.status, count: sql<number>`count(*)::int` })
      .from(emailOutbox)
      .where(eq(emailOutbox.tenantId, tenantId))
      .groupBy(emailOutbox.status);
    const out: Record<string, number> = { queued: 0, sending: 0, sent: 0, failed: 0, dead: 0 };
    for (const r of rows) out[r.status] = Number(r.count);
    return out;
  }
}