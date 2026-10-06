import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

/** Canonical public brand. Kept in sync with the frontend's src/lib/brand.ts. */
const BRAND_NAME = 'Baroot CNC Solutions';

export interface ProviderSendParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** Overrides the configured sender. Used for per-tenant branding (P2). */
  from?: string | null;
}

export type ProviderResult =
  | { ok: true; providerId: string | null }
  | { ok: false; statusCode: number; code: string; message: string; retryable: boolean };

/**
 * The transport. Everything that talks to Resend lives here so the retry,
 * backoff and error-classification logic exists exactly once.
 *
 * The critical detail this preserves: **the Resend SDK resolves on API errors
 * rather than throwing.** It returns `{ data: null, error: { statusCode, message } }`
 * for a 4xx or 5xx and only rejects on a transport fault. Awaiting the call and
 * returning `true` therefore reported every delivery failure as success — an
 * unverified sending domain (403), a bad recipient (422), a suppressed address —
 * with nothing logged and nothing thrown. That is why signup could claim an
 * email was sent when none ever was.
 */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resendClient: any = null;
  private readonly isDev: boolean;

  get isConfigured(): boolean {
    return !!this.resendClient;
  }

  constructor(private config: ConfigService) {
    this.isDev = config.get('NODE_ENV') === 'development';
    const apiKey = config.get('RESEND_API_KEY');
    if (apiKey) {
      try {
        // Deliberately a lazy require, not a static import: email is only wired up when
        // a key exists, and this keeps the Resend SDK out of every boot. The catch is
        // what makes the unconfigured path degrade to logging instead of failing.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Resend = require('resend');
        this.resendClient = new Resend.Resend(apiKey);
      } catch {
        this.logger.warn('Resend package not available, emails will be logged only');
      }
    } else {
      this.logger.log('No RESEND_API_KEY set, emails will be logged in development mode');
    }
  }

  async send(params: ProviderSendParams): Promise<ProviderResult> {
    if (this.isDev) {
      this.logger.log(`[DEV EMAIL] To: ${params.to} | Subject: ${params.subject}`);
    }

    if (!this.resendClient) {
      // Nothing was sent, so say so. Reporting success here would be a fail-open
      // on a security-relevant path: any caller, metric or audit trusting this
      // result would be lied to.
      if (!this.isDev) {
        this.logger.error(
          'RESEND_API_KEY is not set — email NOT sent. Set it to deliver mail in production.',
        );
      }
      return {
        ok: false,
        statusCode: 0,
        code: 'provider_not_configured',
        message: 'RESEND_API_KEY is not configured',
        retryable: false,
      };
    }

    return this.sendWithRetry(params, 3);
  }

  private async sendWithRetry(params: ProviderSendParams, retriesLeft: number): Promise<ProviderResult> {
    try {
      const result = await this.resendClient.emails.send({
        from: params.from ?? this.fromAddress(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      });

      // Resolved-with-error: a real API rejection, not a delivery.
      if (result?.error) {
        const apiError = result.error as { statusCode?: number; message?: string; name?: string };
        const statusCode = apiError.statusCode ?? 0;
        const code = apiError.name ?? 'provider_error';
        const message = apiError.message ?? 'unknown';
        this.logger.error(`Email provider rejected ${params.to} [${statusCode} ${code}]: ${message}`);
        if (retriesLeft > 0 && this.isRetryable(statusCode)) {
          await new Promise((r) => setTimeout(r, Math.pow(2, 4 - retriesLeft) * 500));
          return this.sendWithRetry(params, retriesLeft - 1);
        }
        return { ok: false, statusCode, code, message, retryable: false };
      }

      return { ok: true, providerId: result?.data?.id ?? null };
    } catch (error: any) {
      const statusCode = error?.statusCode ?? error?.status ?? 0;
      const message = error?.message ?? 'transport error';
      this.logger.error(`Failed to send email to ${params.to}: ${message}`);
      const retryable = this.isRetryable(statusCode) || error?.code === 'ETIMEDOUT';
      if (retriesLeft > 0 && retryable) {
        await new Promise((r) => setTimeout(r, Math.pow(2, 4 - retriesLeft) * 500));
        return this.sendWithRetry(params, retriesLeft - 1);
      }
      return {
        ok: false,
        statusCode,
        code: error?.code ?? 'transport_error',
        message,
        retryable,
      };
    }
  }

  /**
   * 5xx, 429 and timeouts are worth another attempt. 4xx is not: retrying an
   * unverified-domain 403 five times only delays the operator's signal by six
   * hours, so those go straight to `dead` in the outbox.
   */
  isRetryable(statusCode: number): boolean {
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * The From header, as Resend wants it: `"Display Name <address>"`.
   *
   * `SMTP_FROM` must be a bare address (the config schema validates it as an
   * email). Resend rejects an unverified sending domain outright with a 403, so
   * this is also the knob to point at a verified domain once one exists.
   */
  fromAddress(): string {
    const address = this.config.get('SMTP_FROM');
    return `${BRAND_NAME} <${address || 'onboarding@resend.dev'}>`;
  }
}