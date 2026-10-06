import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { EmailProvider } from './email.provider';

/**
 * The pre-existing transactional mail helpers, moved out of `modules/auth/` and
 * retargeted onto the shared provider.
 *
 * Why the bodies are still hand-written HTML rather than compiled from
 * templates: these are live, working signup and password-reset mails. Rewriting
 * them to the new compiler in the same change that introduces the compiler would
 * mean a compiler bug could break authentication email on the way in. They keep
 * the inline markup they had, gain only the corrected transport contract, and are
 * migrated onto seeded templates in P1 once the compiler is snapshot-pinned.
 * Tracked as part of the P1 auth-trigger migration, not forgotten.
 *
 * A falsy return means "not delivered". It is never `true` optimistically.
 */
@Injectable()
export class EmailService {
  constructor(
    private provider: EmailProvider,
    private config: ConfigService,
  ) {}

  /** Whether a provider is configured. Relied on by notifications.service. */
  get isConfigured(): boolean {
    return this.provider.isConfigured;
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    const result = await this.provider.send(params);
    return result.ok;
  }

  sendVerificationEmail(to: string, token: string, _tenantSlug: string): Promise<boolean> {
    const url = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;
    return this.send({
      to,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0b6b5f;">Welcome to Baroot CNC Solutions</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #0b6b5f; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
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
          <h1 style="color: #0b6b5f;">Password Reset</h1>
          <p>Click the button below to reset your password:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #0b6b5f; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
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
          <h1 style="color: #0b6b5f;">Password Changed</h1>
          <p>Your password was successfully changed.</p>
          <p style="color: #666; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
        </body></html>`,
      text: "Your password was successfully changed.\n\nIf you didn't make this change, please contact support immediately.",
    });
  }

  sendEmailChangedNotification(to: string, newEmail: string): Promise<boolean> {
    return this.send({
      to,
      subject: 'Your email address has been changed',
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0b6b5f;">Email Changed</h1>
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
          <h1 style="color: #0b6b5f;">Confirm Email Change</h1>
          <p>Click the button below to confirm this email address for your account:</p>
          <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #0b6b5f; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Confirm Email</a>
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
          <h1 style="color: #0b6b5f;">2FA Enabled</h1>
          <p>Two-factor authentication was enabled on your account.</p>
          <p style="color: #666; font-size: 14px;">If you didn't enable this, please contact support immediately.</p>
        </body></html>`,
      text: "Two-factor authentication was enabled on your account.\n\nIf you didn't enable this, please contact support immediately.",
    });
  }
}