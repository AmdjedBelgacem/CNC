import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TRIGGER_REGISTRY, getTrigger, allowedPathsFor, isKnownTrigger } from '../src/modules/email/trigger.registry';
import { renderEmail, DEFAULT_EMAIL_LAYOUT } from '../src/modules/email/email-compiler';
import { interpolate, extractTokens } from '../src/modules/email/email-interpolator';
import type { TriggerDef } from '../src/modules/email/trigger.registry';

const REPO_ROOT = join(__dirname, '../../..');

describe('trigger registry — contract', () => {
  it('has unique keys', () => {
    const keys = TRIGGER_REGISTRY.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every trigger a namespaced key', () => {
    for (const t of TRIGGER_REGISTRY) {
      expect(t.key, `${t.key} must be namespaced`).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('declares every required variable with a type, label and example', () => {
    for (const t of TRIGGER_REGISTRY) {
      expect(t.variables.length, `${t.key} has no variables`).toBeGreaterThan(0);
      for (const v of t.variables) {
        expect(v.path, `${t.key}.${v.path}`).toBeTruthy();
        expect(v.type, `${t.key}.${v.path}`).toBeTruthy();
        expect(v.label, `${t.key}.${v.path}`).toBeTruthy();
        expect(v.example, `${t.key}.${v.path} needs an example`).toBeTruthy();
        if (v.type === 'enum') {
          expect(v.enumValues?.length, `${t.key}.${v.path} enum needs values`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('does not declare duplicate variable paths on one trigger', () => {
    for (const t of TRIGGER_REGISTRY) {
      const paths = t.variables.map((v) => v.path);
      expect(new Set(paths).size, `${t.key} has duplicate variable paths`).toBe(paths.length);
    }
  });

  /**
   * A variable declared required but absent from the sample payload would make
   * every admin preview of that template throw, and would make the published
   * reference artifact unrenderable.
   */
  it('provides every required variable in its own sample payload', () => {
    for (const t of TRIGGER_REGISTRY) {
      for (const v of t.variables.filter((x) => x.required)) {
        const resolved = resolve(t.samplePayload, v.path);
        expect(resolved, `${t.key} is missing required sample value for ${v.path}`).not.toBeUndefined();
      }
    }
  });

  it('keeps the sample payload free of forbidden paths', () => {
    for (const t of TRIGGER_REGISTRY) {
      const json = JSON.stringify(t.samplePayload);
      expect(json).not.toContain('__proto__');
      expect(json).not.toContain('constructor');
    }
  });

  it('marks idempotent triggers so the caller knows to pass a key', () => {
    for (const t of TRIGGER_REGISTRY) {
      expect(typeof t.idempotent, `${t.key}`).toBe('boolean');
    }
  });

  /**
   * Every cited emit site must exist. Without this the registry silently drifts
   * from reality: a trigger can keep advertising a contract that nothing sends.
   */
  it('cites emit sites that exist in the repo', () => {
    for (const t of TRIGGER_REGISTRY) {
      for (const site of t.emitSites) {
        expect(existsSync(join(REPO_ROOT, site)), `${t.key} cites missing file ${site}`).toBe(true);
      }
    }
  });

  it('resolves and looks up triggers by key', () => {
    for (const t of TRIGGER_REGISTRY) {
      expect(getTrigger(t.key)).toBe(t);
      expect(isKnownTrigger(t.key)).toBe(true);
      expect(allowedPathsFor(t)).toEqual(t.variables.map((v) => v.path));
    }
    expect(getTrigger('nope.not_real')).toBeUndefined();
    expect(isKnownTrigger('nope.not_real')).toBe(false);
  });

  it('covers the triggers P0/P1/P2 promise', () => {
    for (const key of [
      'auth.email_verification',
      'auth.welcome',
      'auth.password_reset',
      'auth.password_changed',
      'lms.enrollment_confirmed',
      'lms.certificate_issued',
      'commerce.order_paid',
      'commerce.order_failed',
      'commerce.refund_issued',
      'admin.custom',
    ]) {
      expect(isKnownTrigger(key), `${key} must be registered`).toBe(true);
    }
  });
});

describe('trigger registry — every sample payload renders', () => {
  /**
   * The real value of a sample payload: it is what the admin editor previews
   * and what a published version's reference artifact is rendered from. If any
   * of these throws, the trigger is unusable in the product.
   */
  const brand = {
    fromAddress: 'onboarding@resend.dev',
    supportEmail: 'support@barootcnc.com',
    replyTo: null,
    unsubscribeUrlPath: null,
    utm: null,
  };

  it.each(TRIGGER_REGISTRY.map((t) => [t.key, t] as const))(
    'renders %s with its own sample payload',
    (key, trigger: TriggerDef) => {
      const allowed = allowedPathsFor(trigger);
      const subject = interpolate('Notification', trigger.samplePayload, {
        escape: (v) => v,
        allowedPaths: allowed,
      });
      const out = renderEmail(
        DEFAULT_EMAIL_LAYOUT,
        trigger.samplePayload,
        subject,
        null,
        { ...brand, allowedPaths: allowed },
      );
      expect(out.html.length).toBeGreaterThan(500);
      expect(out.text.length).toBeGreaterThan(0);
    },
  );

  it('renders the default starter layout against every registered trigger', () => {
    // A starter layout carrying a variable no trigger declares would break the
    // moment an admin bound it. This is the guard against that regression.
    for (const t of TRIGGER_REGISTRY) {
      const allowed = allowedPathsFor(t);
      expect(() =>
        renderEmail(DEFAULT_EMAIL_LAYOUT, t.samplePayload, 'Notification', null, {
          ...brand,
          allowedPaths: allowed,
        }),
      ).not.toThrow();
    }
  });

  it('renders a variable from every declared path', () => {
    for (const t of TRIGGER_REGISTRY) {
      for (const v of t.variables) {
        const token = `{{${v.path}}}`;
        // Missing values resolve via the sample payload; a throw here means the
        // declared path and the payload disagree.
        expect(() =>
          interpolate(token, t.samplePayload, { escape: (x) => x, allowedPaths: allowedPathsFor(t) }),
        ).not.toThrow();
      }
    }
  });
});

describe('compileHash stability', () => {
  it('produces a stable hash for the default layout', async () => {
    const { createHash } = await import('node:crypto');
    const brand = {
      fromAddress: 'onboarding@resend.dev',
      supportEmail: null,
      replyTo: null,
      unsubscribeUrlPath: null,
      utm: null,
    };
    const payload = { user: { firstName: 'Ahmed' }, actionUrl: 'https://example.com/go' };
    const a = renderEmail(DEFAULT_EMAIL_LAYOUT, payload, 'Welcome', 'Check inbox', brand);
    const b = renderEmail(DEFAULT_EMAIL_LAYOUT, payload, 'Welcome', 'Check inbox', brand);
    const hash = (r: typeof a) => createHash('sha256').update(`1\u0000${r.html}\u0000${r.text}`).digest('hex');
    expect(hash(a)).toBe(hash(b));
  });
});

function resolve(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}