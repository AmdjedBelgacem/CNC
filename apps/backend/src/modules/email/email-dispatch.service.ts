import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { DrizzleService } from '../../database/drizzle.service';
import { emailOutbox, emailTemplates } from '../../database/schema/emails';
import { EmailProvider } from './email.provider';
import { EmailTemplatesService } from './email-templates.service';
import { EmailRenderError } from './email-interpolator';
import { allowedPathsFor, getTrigger, isKnownTrigger, TriggerDef } from './trigger.registry';

export interface EnqueueParams {
  triggerKey: string;
  tenantId: string;
  to: string;
  payload: Record<string, unknown>;
  /**
   * Only for triggers whose contract is `idempotent: true`. Omitting it on an
   * idempotent trigger is a bug we log loudly rather than silently allowing a
   * duplicate receipt.
   */
  idempotencyKey?: string;
  recipientUserId?: string | null;
  locale?: string | null;
}

export type EnqueueOutcome =
  | { queued: true; outboxId: string; duplicate: false }
  /**
   * The unique index rejected a duplicate. A success, not a failure: it is what
   * stops a replayed payment webhook sending a second receipt.
   */
  | { queued: false; duplicate: true; reason: 'duplicate' }
  | {
      queued: false;
      duplicate: false;
      reason: 'unknown_trigger' | 'no_binding' | 'disabled' | 'render_error';
      detail?: string;
    };

/**
 * Enqueue-only. This service NEVER calls the provider.
 *
 * That is the whole design: the HTTP request that discovers "this order was
 * paid" or "this account registered" performs one INSERT and returns. Provider
 * latency, provider outages and provider rate limits are therefore structurally
 * unable to affect signup, checkout or the payment webhook — and the outbox row
 * commits in the same transaction as the domain event, so the mail can neither
 * be lost between commit and enqueue nor fired before the commit lands.
 *
 * BullMQ was considered and rejected: it needs a real Redis (still not
 * provisioned in production), and it would give at-least-once delivery, which
 * means reimplementing idempotency anyway. The unique index here already does
 * that in the database, where it cannot be bypassed.
 */
@Injectable()
export class EmailDispatchService {
  private readonly logger = new Logger(EmailDispatchService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly templates: EmailTemplatesService,
    private readonly provider: EmailProvider,
  ) {}

  async enqueue(params: EnqueueParams): Promise<EnqueueOutcome> {
    const trigger = getTrigger(params.triggerKey);
    if (!trigger) {
      return { queued: false, duplicate: false, reason: 'unknown_trigger', detail: params.triggerKey };
    }
    if (!isKnownTrigger(params.triggerKey)) {
      return { queued: false, duplicate: false, reason: 'unknown_trigger' };
    }
    if (trigger.idempotent && !params.idempotencyKey) {
      this.logger.error(
        `Trigger ${params.triggerKey} is marked idempotent but was enqueued without an idempotencyKey; duplicates are possible`,
      );
    }

    const binding = await this.templates.resolveBinding(
      params.tenantId,
      params.triggerKey,
      params.locale ?? null,
    );
    if (!binding) return { queued: false, duplicate: false, reason: 'no_binding' };
    if (!binding.enabled) return { queued: false, duplicate: false, reason: 'disabled' };

    const template = await this.loadTemplate(binding.templateId);
    if (!template) return { queued: false, duplicate: false, reason: 'no_binding', detail: 'template missing' };
    if (template.status === 'archived') {
      return { queued: false, duplicate: false, reason: 'disabled', detail: 'template archived' };
    }

    const brand = await this.templates.brandFor(params.tenantId);
    const subjectTemplate = template.subjectTemplate || template.name;

    let rendered;
    try {
      rendered = this.templates.renderForTrigger(
        template.layout,
        trigger,
        params.payload,
        subjectTemplate,
        template.preheaderTemplate ?? null,
        {
          fromAddress: this.provider.fromAddress(),
          supportEmail: brand.supportEmail,
          replyTo: brand.replyTo,
          // Only marketing-style mail carries an unsubscribe. Transactional mail
          // (receipts, certificates, password resets) must not: an unsubscribe
          // link on a receipt teaches recipients to ignore the domain.
          unsubscribeUrlPath: trigger.category === 'custom' ? 'admin.actionUrl' : null,
          utm: brand.utm,
        },
      );
    } catch (error) {
      // Fail loud and specific. Rendering an order receipt with a blank total is
      // worse than not sending it, so this never degrades to a partial send.
      const detail = error instanceof EmailRenderError ? error.message : String(error);
      this.logger.error(`Email render failed for ${params.triggerKey}: ${detail}`);
      return { queued: false, duplicate: false, reason: 'render_error', detail };
    }

    const bodyHash = createHash('sha256')
      .update(rendered.html)
      .digest('hex');
    const scheduledFor = new Date(Date.now() + (binding.delayMinutes ?? 0) * 60_000);

    const inserted = await this.drizzle.db
      .insert(emailOutbox)
      .values({
        tenantId: params.tenantId,
        triggerKey: params.triggerKey,
        templateId: template.id,
        templateVersion: template.version ?? 0,
        recipientEmail: params.to,
        recipientUserId: params.recipientUserId ?? null,
        locale: params.locale ?? null,
        payload: params.payload,
        subject: rendered.subject.slice(0, 500),
        fromAddress: this.provider.fromAddress(),
        replyTo: brand.replyTo,
        idempotencyKey: params.idempotencyKey ?? null,
        status: 'queued',
        provider: 'resend',
        bodyHash,
        scheduledFor,
      })
      // No conflict target on purpose. The unique index on idempotency_key is
      // PARTIAL (`WHERE idempotency_key IS NOT NULL`), and Postgres refuses a
      // partial index as an ON CONFLICT arbiter — it raises "no unique or
      // exclusion constraint matching the ON CONFLICT specification" (42P10).
      // A target-less ON CONFLICT covers every unique violation, and
      // idempotency_key is the only unique column on this table besides the PK.
      .onConflictDoNothing()
      .returning({ id: emailOutbox.id });

    const row = inserted[0];
    if (!row) {
      // The unique index rejected a duplicate. Expected, not an error: this is
      // exactly what stops a replayed payment webhook sending a second receipt.
      this.logger.log(`Duplicate send suppressed for ${params.triggerKey} (${params.idempotencyKey})`);
      return { queued: false, duplicate: true, reason: 'duplicate' };
    }

    return { queued: true, outboxId: row.id, duplicate: false };
  }

  private async loadTemplate(templateId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);
    return row;
  }

  /** The closed allowlist for a trigger, exposed for callers building payloads. */
  allowedPaths(trigger: TriggerDef): string[] {
    return allowedPathsFor(trigger);
  }
}