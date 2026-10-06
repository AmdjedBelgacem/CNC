import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmailService } from '../src/modules/email/email.service';
import { EmailProvider } from '../src/modules/email/email.provider';
import { TotpService } from '../src/modules/auth/services/totp.service';

/**
 * Fail-closed behaviour for the two external integrations that have no credentials in
 * this environment (Resend, Stripe).
 *
 * A missing key must never be reported as success. Both providers degrade gracefully —
 * that is the right choice — but "degraded" has to be *visible* in the return value, not
 * only in a log line. Otherwise a caller, a metric or an audit that trusts the boolean
 * believes an email was delivered or a payment was taken when neither happened.
 */

const src = (rel: string) => readFileSync(join(__dirname, '..', 'src', rel), 'utf8');

function makeEmail(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] } as any;
  // EmailService now delegates transport to EmailProvider (the class moved out of
  // modules/auth so the outbox and the legacy helpers share exactly one sender),
  // so the provider is what has to be constructed.
  return new EmailService(new EmailProvider(config), config);
}

describe('EmailService — no RESEND_API_KEY must never claim delivery', () => {
  it('reports false in development', async () => {
    const svc = makeEmail({ NODE_ENV: 'development' });
    await expect(
      svc.send({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 'hello' }),
    ).resolves.toBe(false);
  });

  /**
   * The regression. `send()` used to `return !this.isDev`, so with no client configured it
   * resolved `true` in production — asserting a password-reset or verification email had
   * been sent when nothing was. Logged-but-not-sent is fine; *reported as sent* is not.
   */
  it('reports false in PRODUCTION too (used to return true — a silent fail-open)', async () => {
    const svc = makeEmail({ NODE_ENV: 'production' });
    await expect(
      svc.send({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 'hello' }),
    ).resolves.toBe(false);
  });

  it('password-reset and verification emails inherit the same contract', async () => {
    for (const mode of ['development', 'production']) {
      const svc = makeEmail({ NODE_ENV: mode, FRONTEND_URL: 'http://localhost:3000' });
      await expect(svc.sendPasswordResetEmail('a@b.c', 'tok', 'app')).resolves.toBe(false);
      await expect(svc.sendVerificationEmail('a@b.c', 'tok', 'app')).resolves.toBe(false);
    }
  });

  // Anchored to a statement (`;`) rather than the bare expression, because the fix is
  // described in a comment that quotes the old code. Matching the loose form would fail
  // on the comment and, worse, would keep passing after someone reintroduced the bug.
  it('never returns a bare `!this.isDev` again', () => {
    // The fail-open guard now belongs to the provider, which is where the
    // unconfigured branch lives after the class moved out of modules/auth.
    expect(src('modules/email/email.provider.ts')).not.toMatch(/return\s+!this\.isDev\s*;/);
    expect(src('modules/email/email.service.ts')).not.toMatch(/return\s+!this\.isDev\s*;/);
  });
});

describe('TOTP — the real library must be in use; the fallback must fail closed', () => {
  /**
   * The strongest guard here. `totp.service.ts` loads `otplib/functional` at module scope
   * and falls back to a stub whose `verifySync` always returns `false`. A *negative* test
   * cannot tell the two apart — bogus codes are rejected either way. Accepting a genuine
   * code proves the real library is actually loaded, so this fails loudly if a dependency
   * change ever pushes the service onto the degraded path.
   */
  it('accepts a genuine TOTP and rejects bogus ones (proves the fallback is NOT active)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const otplib = require('otplib/functional');
    const secret = otplib.generateSecret();
    const token = otplib.generateSync({ secret });

    const svc = new TotpService({} as any); // verifyToken does not touch the database
    expect(svc.verifyToken(token, secret)).toBe(true);
    expect(svc.verifyToken('000000', secret)).toBe(false);
    expect(svc.verifyToken('111111', secret)).toBe(false);
    expect(svc.verifyToken('', secret)).toBe(false);
    expect(svc.verifyToken(token, '')).toBe(false);
  });

  it('the degraded fallback never mints a fixed, shared secret', () => {
    // The literal is deliberately absent from the source (even from comments), so this
    // assertion can legitimately check the whole file.
    expect(src('modules/auth/services/totp.service.ts')).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('the degraded fallback always denies verification', () => {
    expect(src('modules/auth/services/totp.service.ts')).toMatch(
      /verifySync:\s*\(\)\s*=>\s*false/,
    );
  });
});

describe('PaymentsService — unconfigured Stripe must never claim payment', () => {
  const payments = src('modules/payments/payments.service.ts');

  it('stub checkout flags itself and reports no money taken', () => {
    expect(payments).toMatch(/paymentCollected:\s*false/);
    expect(payments).toMatch(/mode:\s*'stub'/);
  });

  /**
   * The original P0: stub checkout returned `/checkout/confirm?orderId=…`, a route that does
   * not exist in the frontend, so every dev checkout dead-ended in a 404 *after* the order
   * row had been written. It must point at a page that actually renders.
   */
  // Matched as a `url:` assignment, not as a bare substring: the old route is named in a
  // comment explaining the bug, and a naive `not.toMatch(/checkout\/confirm/)` fails on
  // that comment instead of on real code.
  it('stub checkout never targets the non-existent /checkout/confirm route', () => {
    expect(payments).not.toMatch(/url:\s*`[^`]*checkout\/confirm/);
    expect(payments).toMatch(/url:\s*`\/checkout\/success\?orderId=/);
  });

  it('a live-mode Stripe failure throws instead of silently falling back to the stub', () => {
    expect(payments).toMatch(/Stripe session creation failed in live mode/);
    expect(payments).toMatch(/throw new BadRequestException/);
  });

  it('the webhook is inert while Stripe is unconfigured', () => {
    expect(payments).toMatch(/Webhook received but Stripe not configured — ignoring/);
    expect(payments).toMatch(/return\s*\{\s*received:\s*true,\s*live:\s*false\s*\}/);
  });
});
