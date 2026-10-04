'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  Building2,
  CreditCard,
  FileWarning,
  Flag,
  Loader2,
  Mail,
  Settings2,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { FormSection } from '@/components/admin/admin-form';
import { StatusPill, type Tone } from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Super-admin control over which platform-critical alerts are shown.
 *
 * Stored server-side per super admin, so the choice follows the person rather
 * than the browser, and muting a platform alert is independent of the same
 * person's personal notification settings.
 */

type Severity = 'critical' | 'warning' | 'info';

interface Group {
  key: string;
  label: string;
  description: string;
  severity: Severity;
  defaultEnabled: boolean;
  icon: string;
  enabled: boolean;
}

// Keyed by the `icon` the API sends (kebab-case), with the group key as a
// fallback so a new group still renders something rather than nothing.
const ICONS: Record<string, typeof Activity> = {
  'credit-card': CreditCard,
  'shield-alert': ShieldAlert,
  building: Building2,
  activity: Activity,
  'file-warning': FileWarning,
  flag: Flag,
  mail: Mail,
  payments: CreditCard,
  security: ShieldAlert,
  tenants: Building2,
  system: Activity,
  content: FileWarning,
  moderation: Flag,
  digest: Mail,
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'rose',
  warning: 'amber',
  info: 'blue',
};

export function PlatformAlertSettings() {
  const t = useTranslations('admin.platformAlerts');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/platform-alerts/settings', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (e: any) {
      setError(e?.message ?? t('loadFailed', { default: 'Could not load alert settings' }));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: string, next: boolean) => {
    setSavingKey(key);
    setError(null);
    // Optimistic: the switch should feel instant, and the server rejects
    // unknown groups anyway, so a failed save is corrected by the reload below.
    setGroups((prev) => prev?.map((g) => (g.key === key ? { ...g, enabled: next } : g)) ?? prev);
    try {
      const res = await fetch('/api/proxy/admin/platform-alerts/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: { [key]: next } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGroups((prev) => prev?.map((g) => ({ ...g, enabled: data[g.key] ?? g.enabled })) ?? prev);
    } catch (e: any) {
      setError(e?.message ?? t('saveFailed', { default: 'Could not save' }));
      void load();
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <FormSection
      title={t('settingsTitle', { default: 'Platform alerts' })}
      icon={TriangleAlert}
      description={t('settingsDesc', {
        default:
          'Choose which platform-critical alerts reach you. These are separate from your personal notifications, and muting one here never affects those.',
      })}
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      {groups === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => {
            const Icon = ICONS[g.icon] ?? ICONS[g.key] ?? Activity;
            const changed = g.enabled !== g.defaultEnabled;
            return (
              <li
                key={g.key}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center',
                  g.enabled ? 'border-border bg-card' : 'border-border bg-muted/30',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    !g.enabled
                      ? 'bg-muted text-muted-foreground'
                      : g.severity === 'critical'
                        ? 'bg-destructive/12 text-destructive'
                        : g.severity === 'warning'
                          ? 'bg-warning/12 text-warning'
                          : 'bg-info/12 text-info',
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-13 font-semibold text-foreground">
                      {t(`groups.${g.key}.label`, { default: g.label })}
                    </span>
                    <StatusPill
                      label={t(`severity.${g.severity}`, { default: g.severity })}
                      tone={SEVERITY_TONE[g.severity]}
                      dot={false}
                    />
                    {changed && (
                      <StatusPill
                        label={t('customised', { default: 'Customised' })}
                        tone="purple"
                        dot={false}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(`groups.${g.key}.description`, { default: g.description })}
                  </p>
                </div>

                <label className="flex shrink-0 cursor-pointer items-center gap-2.5 self-start sm:self-center">
                  <span className="text-xs font-semibold text-foreground">
                    {g.enabled
                      ? t('shown', { default: 'Shown' })
                      : t('muted', { default: 'Muted' })}
                  </span>
                  {savingKey === g.key ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={g.enabled}
                      aria-label={t('toggleGroup', {
                        group: t(`groups.${g.key}.label`, { default: g.label }),
                        default: 'Toggle {group} alerts',
                      })}
                      onClick={() => void toggle(g.key, !g.enabled)}
                      className={cn(
                        'relative h-6 w-11 rounded-full transition',
                        g.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                          g.enabled ? 'start-0.5' : 'start-5.5',
                        )}
                      />
                    </button>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-2xs leading-relaxed text-muted-foreground">
        <Settings2 className="mt-px size-3.5 shrink-0" />
        {t('settingsFootNote', {
          default:
            'Muting a group stops new alerts of that kind from being raised for you. Alerts already delivered stay in your feed, and every change is recorded in the audit log.',
        })}
      </p>
    </FormSection>
  );
}
