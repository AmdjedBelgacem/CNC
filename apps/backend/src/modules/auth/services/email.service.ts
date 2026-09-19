import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resendClient: any = null;
  private readonly isDev: boolean;

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

  async send(params: SendEmailParams): Promise<boolean> {
    if (this.isDev) {
      this.logger.log(`[DEV EMAIL] To: ${params.to} | Subject: ${params.subject}`);
      this.logger.log(`[DEV EMAIL] Text: ${params.text.substring(0, 200)}...`);
    }

    if (!this.resendClient) {
      // Nothing was sent, so say so. This used to `return !this.isDev`, which reported
      // `true` in production — claiming a password-reset or verification email had been
      // delivered when no provider was configured at all. A silent fail-open on a
      // security-relevant path: any future caller, metric or audit that trusts this
      // boolean would be lied to. Every current caller is fire-and-forget, so `false`
      // changes nothing today and keeps the contract honest.
      if (!this.isDev) {
        this.logger.error(
          'RESEND_API_KEY is not set — email NOT sent. Set it to deliver mail in production.',
        );
      }
      return false;
    }

    return this.sendWithRetry(params, 3);
  }

  private async sendWithRetry(params: SendEmailParams, retriesLeft: number): Promise<boolean> {
    try {
      await this.resendClient.emails.send({
        from: `TITANS of Manufacturing <${this.config.get('SMTP_FROM') || 'noreply@titansofmanufacturing.com'}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${params.to}: ${error.message}`);
      if (retriesLeft > 0 && this.shouldRetry(error)) {
        const delay = Math.pow(2, 4 - retriesLeft) * 500;
        await new Promise(r => setTimeout(r, delay));
        return this.sendWithRetry(params, retriesLeft - 1);
      }
      return false;
    }
  }

  private shouldRetry(error: any): boolean {
    const status = error?.statusCode || error?.status || 0;
    return status >= 500 || status === 429 || error?.code === 'ETIMEDOUT';
  }

  sendVerificationEmail(to: string, token: string, _tenantSlug: string): Promise<boolean> {
    const url = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;
    return this.send({
      to,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">Welcome to TITANS of Manufacturing</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${url}">${url}</a></p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">If you didn't create an account, you can ignore this email.</p>
        </body></html>`,
      text: `Verify your email: ${url}\n\nThis link expires in 24 hours.`,
    });
  }

  sendPasswordResetEmail(to: string, token: string, _tenantSlug: string): Promise<boolean> {
    const url = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
    return this.send({
      to,
      subject: 'Reset your password',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">Password Reset</h1>
          <p>Click the button below to reset your password:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${url}">${url}</a></p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">If you didn't request a password reset, you can ignore this email.</p>
        </body></html>`,
      text: `Reset your password: ${url}\n\nThis link expires in 1 hour.`,
    });
  }

  sendPasswordChangedNotification(to: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Your password has been changed',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">Password Changed</h1>
          <p>Your password was successfully changed.</p>
          <p style="color: #666; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
        </body></html>`,
      text: 'Your password was successfully changed.\n\nIf you didn\'t make this change, please contact support immediately.',
    });
  }

  sendEmailChangedNotification(to: string, newEmail: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Your email address has been changed',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">Email Changed</h1>
          <p>Your email address was changed to <strong>${newEmail}</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
        </body></html>`,
      text: `Your email address was changed to ${newEmail}.\n\nIf you didn't make this change, please contact support immediately.`,
    });
  }

  sendEmailChangeVerification(to: string, token: string, _tenantSlug: string): Promise<boolean> {
    const url = `${this.config.get('FRONTEND_URL')}/verify-email-change?token=${token}`;
    return this.send({
      to,
      subject: 'Confirm your email change',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">Confirm Email Change</h1>
          <p>Click the button below to confirm this email address for your account:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Confirm Email</a>
          <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${url}">${url}</a></p>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">If you didn't request this change, please contact support immediately.</p>
        </body></html>`,
      text: `Confirm your email change: ${url}\n\nThis link expires in 24 hours.`,
    });
  }

  send2faEnabledNotification(to: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Two-factor authentication enabled',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed;">2FA Enabled</h1>
          <p>Two-factor authentication was enabled on your account.</p>
          <p style="color: #666; font-size: 14px;">If you didn't enable this, please contact support immediately.</p>
        </body></html>`,
      text: 'Two-factor authentication was enabled on your account.\n\nIf you didn\'t enable this, please contact support immediately.',
    });
  }
}
