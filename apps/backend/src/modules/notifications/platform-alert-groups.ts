/**
 * Platform-critical alert taxonomy.
 *
 * A `super_admin` looks after the whole platform, so their alerting is a
 * different job from a learner's: these are operational signals about tenants,
 * money, security and system health — not "someone liked your comment".
 *
 * The registry is the single source of truth for three things that would
 * otherwise drift apart: which groups exist, which are on by default, and what
 * the settings screen renders. The API returns the same list, so a new group
 * cannot be emitted without also appearing in the UI.
 *
 * `defaultEnabled` is a product decision, not a technical one: everything a
 * super admin would want to be interrupted for is on by default, and the
 * noisiest operational chatter is on by default too but clearly labelled
 * "warning" so an operator can judge it.
 */

export type PlatformAlertSeverity = 'critical' | 'warning' | 'info';

export interface PlatformAlertGroup {
  key: string;
  /** English label; translated on the client via `admin.platformAlerts.groups.*`. */
  label: string;
  description: string;
  severity: PlatformAlertSeverity;
  defaultEnabled: boolean;
  icon: string;
}

export const PLATFORM_ALERT_GROUPS: PlatformAlertGroup[] = [
  {
    key: 'payments',
    label: 'Payments & revenue',
    description:
      'Failed captures, amount or currency mismatches, refunds and voided settlements.',
    severity: 'critical',
    defaultEnabled: true,
    icon: 'credit-card',
  },
  {
    key: 'security',
    label: 'Security',
    description:
      'Admin accounts losing 2FA, forced password resets, and suspicious sign-in patterns.',
    severity: 'critical',
    defaultEnabled: true,
    icon: 'shield-alert',
  },
  {
    key: 'tenants',
    label: 'Tenants',
    description: 'New workspace signups, suspensions, deletions and plan-limit pressure.',
    severity: 'warning',
    defaultEnabled: true,
    icon: 'building',
  },
  {
    key: 'system',
    label: 'System health',
    description:
      'Unhandled webhooks, failing background work and provider connectivity problems.',
    severity: 'warning',
    defaultEnabled: true,
    icon: 'activity',
  },
  {
    key: 'content',
    label: 'Publishing failures',
    description:
      'Content that failed to publish or process across any tenant, e.g. broken media or builders.',
    severity: 'warning',
    defaultEnabled: false,
    icon: 'file-warning',
  },
  {
    key: 'moderation',
    label: 'Moderation & abuse',
    description: 'Abuse reports, spam spikes and automated moderation interventions.',
    severity: 'warning',
    defaultEnabled: false,
    icon: 'flag',
  },
  {
    key: 'digest',
    label: 'Weekly platform digest',
    description: 'A single recurring summary of activity, growth and open issues.',
    severity: 'info',
    defaultEnabled: false,
    icon: 'mail',
  },
];

const GROUP_KEYS = new Set(PLATFORM_ALERT_GROUPS.map((g) => g.key));

export function isPlatformAlertGroup(key: string): boolean {
  return GROUP_KEYS.has(key);
}

export function platformAlertGroup(key: string): PlatformAlertGroup | undefined {
  return PLATFORM_ALERT_GROUPS.find((g) => g.key === key);
}

/** Defaults for a user who has never touched the settings screen. */
export function defaultPlatformPrefs(): Record<string, boolean> {
  return Object.fromEntries(PLATFORM_ALERT_GROUPS.map((g) => [g.key, g.defaultEnabled]));
}

/**
 * Merge stored prefs over the defaults.
 *
 * Unknown keys are dropped and missing keys are filled from the registry, so
 * adding a group in this file immediately works for every existing super admin
 * and a stale key from a removed group cannot linger in the UI.
 */
export function mergePlatformPrefs(stored: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const merged = defaultPlatformPrefs();
  if (!stored) return merged;
  for (const [key, value] of Object.entries(stored)) {
    if (GROUP_KEYS.has(key) && typeof value === 'boolean') merged[key] = value;
  }
  return merged;
}
