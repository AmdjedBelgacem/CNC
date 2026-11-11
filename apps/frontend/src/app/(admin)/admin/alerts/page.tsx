'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  ExternalLink,
  CreditCard,
  FileWarning,
  Flag,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { AdminCommandBar, AdminPageHeader, BarButton, BarPrimaryButton } from '@/components/admin/admin-chrome';
import { EmptyState, ErrorBanner, SkeletonRows, StatusPill, type Tone } from '@/components/admin/admin-ui';
import { PillTabs, Toolbar } from '@/components/admin/admin-ui';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { AnimatedNumber } from '@/components/ui/motion';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

/**
 * Platform-critical alert feed (super admins only).
 *
 * Intentionally a separate screen from the personal notification feed. A super
 * admin's own activity is one thing; the operational state of every tenant is
 * another, and mixing them meant platform signals were buried under personal
 * noise. The backend selects this feed by `audience = 'platform'` rather than by
 * tenant, because an alert is filed under the tenant that caused it.
 */

export type PlatformSeverity = 'critical' | 'warning' | 'info';

export interface PlatformAlert {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  group: string | null;
  severity: PlatformSeverity;
  isRead: boolean;
  createdAt: string;
  tenantName: string | null;
  tenantSlug: string | null;
  data: Record<string, unknown>;
}

const GROUP_ICON: Record<string, typeof Activity> = {
  payments: CreditCard,
  security: ShieldAlert,
  tenants: Building2,
  system: Activity,
  content: FileWarning,
  moderation: Flag,
  digest: Mail,
};

const SEVERITY_TONE: Record<PlatformSeverity, Tone> = {
  critical: 'rose',
  warning: 'amber',
  info: 'blue',
};

interface Overview {
  unread: number;
  total: number;
  severity: Record<PlatformSeverity, number>;
  unreadBySeverity: Record<PlatformSeverity, number>;
  byGroup: Record<string, number>;
}

export default function PlatformAlertsPage() {
  const t = useTranslations('admin.platformAlerts');
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('admin');

  const [items, setItems] = useState<PlatformAlert[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<PlatformSeverity | ''>('');
  const [group, setGroup] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '40' });
      if (severity) qs.set('severity', severity);
      if (group) qs.set('group', group);
      if (unreadOnly) qs.set('unreadOnly', 'true');
      const [feed, stats] = await Promise.all([
        fetch(`/api/proxy/admin/platform-alerts?${qs.toString()}`, { credentials: 'include' }),
        fetch('/api/proxy/admin/platform-alerts/overview', { credentials: 'include' }),
      ]);
      if (feed.status === 403) {
        throw new Error(t('noAccess', { default: 'Platform alerts are visible to super admins only.' }));
      }
      if (!feed.ok) throw new Error(`HTTP ${feed.status}`);
      const data = await feed.json();
      setItems(data.items ?? []);
      if (stats.ok) setOverview(await stats.json());
    } catch (e: any) {
      setError(e?.message ?? t('loadFailed', { default: 'Could not load alerts' }));
    } finally {
      setLoading(false);
    }
  }, [severity, group, unreadOnly, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev?.map((a) => (a.id === id ? { ...a, isRead: true } : a)) ?? prev,
    );
    try {
      await api.post(`/admin/platform-alerts/read/${id}`);
      toast({ type: 'ok', title: t('markedReadToast') });
    } catch (e) {
      toast({
        type: 'err',
        title: t('saveFailed'),
        description: e instanceof Error ? e.message : undefined,
      });
    }
    void load();
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await api.post('/admin/platform-alerts/read-all', group ? { group } : {});
      toast({ type: 'ok', title: t('markedAllReadToast') });
    } catch (e) {
      toast({
        type: 'err',
        title: t('saveFailed'),
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
    void load();
  };

  const groups = useMemo(() => Object.keys(overview?.byGroup ?? {}), [overview]);

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Baroot CNC Solutions' }, { label: tAdmin('alerts') }]}
        live={
          // Never claim "All clear" when the alerts could not be loaded at all.
          error
            ? undefined
            : overview && overview.unread > 0
            ? t('unreadCount', { count: overview.unread, default: '{count} unread' })
            : t('allClear', { default: 'All clear' })
        }
        actions={
          <BarButton icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
            {tCommon('refresh', { default: 'Refresh' })}
          </BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            disabled={busy || (overview?.unread ?? 0) === 0}
            onClick={() => void markAllRead()}
          >
            {t('markAllRead', { default: 'Mark all read' })}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] space-y-6 pt-6">
        <AdminPageHeader
          title={t('title', { default: 'Platform alerts' })}
          description={t('subtitle', {
            default:
              'Operational signals from every tenant: money, security, signups and system health. Your personal notifications are separate.',
          })}
        />

        {error && (
          <ErrorBanner message={error} onRetry={() => void load()} retryLabel={tCommon('retry')} />
        )}

        {/* Severity strip: what needs attention, and how urgently. */}
        <div className="grid gap-4 sm:grid-cols-3">
          {(['critical', 'warning', 'info'] as PlatformSeverity[]).map((level, index) => {
            const total = overview?.severity?.[level] ?? 0;
            const unread = overview?.unreadBySeverity?.[level] ?? 0;
            const selected = severity === level;
            return (
              <m.button
                key={level}
                type="button"
                onClick={() => setSeverity(selected ? '' : level)}
                aria-pressed={selected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.emerge, delay: index * 0.05 } }}
                whileHover={{ y: -2, transition: spring.smooth }}
                whileTap={{ scale: 0.99, transition: spring.snappy }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-4 text-start shadow-xs transition-[border-color,background-color,box-shadow] duration-200 hover:shadow-md',
                  selected
                    ? 'border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15'
                    : 'border-border/70 bg-card hover:border-border',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    level === 'critical' && unread > 0
                      ? 'bg-destructive/10 text-destructive'
                      : level === 'warning' && unread > 0
                        ? 'bg-warning/10 text-warning'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  <AlertTriangle className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[28px] font-medium leading-none tracking-[-0.022em] text-foreground">
                    <AnimatedNumber value={unread} animateOnChange />
                    <span className="ms-1.5 font-sans text-sm font-normal tabular-nums text-muted-foreground">
                      / {total}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-xs font-medium capitalize text-muted-foreground">
                    {t(`severity.${level}`, { default: level })}
                  </span>
                </span>
              </m.button>
            );
          })}
        </div>

        <Toolbar>
          <PillTabs
            value={severity}
            onChange={(k) => setSeverity(k as PlatformSeverity | '')}
            options={[
              { key: '', label: t('allSeverities', { default: 'All severities' }) },
              ...(['critical', 'warning', 'info'] as PlatformSeverity[]).map((level) => ({
                key: level as string,
                label: t(`severity.${level}`, { default: level }),
                count: overview?.severity?.[level] ?? 0,
              })),
            ]}
          />
          <PillTabs
            value={group}
            onChange={(k) => setGroup(k)}
            options={[
              { key: '', label: t('allGroups', { default: 'All groups' }) },
              ...groups.map((g) => ({
                key: g,
                label: t(`groups.${g}.label`, { default: g }),
                count: overview?.byGroup?.[g] ?? 0,
              })),
            ]}
          />
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            aria-pressed={unreadOnly}
            className={cn(
              'ms-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]',
              unreadOnly
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-border/80 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <Check className="size-3.5" />
            {t('unreadOnly', { default: 'Unread only' })}
          </button>
        </Toolbar>

        {loading ? (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
            <SkeletonRows rows={5} columns={3} />
          </div>
        ) : error ? null : (items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Activity}
            tone={overview?.unread ? 'amber' : 'blue'}
            title={
              overview?.unread
                ? t('emptyFiltered', { default: 'Nothing matches these filters' })
                : t('emptyTitle', { default: 'No platform alerts' })
            }
            body={
              overview?.unread
                ? t('emptyFilteredBody', {
                    default: 'Try clearing the severity or group filter.',
                  })
                : t('emptyBody', {
                    default:
                      'Nothing critical has been raised across any tenant. New alerts appear here as they happen.',
                  })
            }
          />
        ) : (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
            {items!.map((alert, index) => {
              const Icon = GROUP_ICON[alert.group ?? ''] ?? Activity;
              const body = (
                <>
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                      alert.isRead
                        ? 'bg-muted text-muted-foreground'
                        : alert.severity === 'critical'
                          ? 'bg-destructive/10 text-destructive'
                          : alert.severity === 'warning'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-info/10 text-info',
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        dir="auto"
                        className={cn(
                          'text-sm',
                          alert.isRead ? 'text-foreground/75' : 'font-medium text-foreground',
                        )}
                      >
                        {alert.title}
                      </span>
                      <StatusPill
                        label={t(`severity.${alert.severity}`, { default: alert.severity })}
                        tone={SEVERITY_TONE[alert.severity]}
                        dot={false}
                      />
                      {alert.group && (
                        <StatusPill
                          label={t(`groups.${alert.group}.label`, { default: alert.group })}
                          tone="slate"
                          dot={false}
                        />
                      )}
                      {alert.tenantName && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3" />
                          <span dir="auto">{alert.tenantName}</span>
                        </span>
                      )}
                    </span>
                    {alert.body && (
                      <span
                        dir="auto"
                        className="mt-1 block whitespace-pre-line text-xs leading-relaxed text-muted-foreground"
                      >
                        {alert.body}
                      </span>
                    )}
                    <span className="mt-1.5 block text-xs text-muted-foreground/80">
                      <code dir="ltr" className="font-mono">
                        {alert.type}
                      </code>{' '}
                      · {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </span>
                </>
              );
              return (
                <m.li
                  key={alert.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: ease.emerge, delay: Math.min(index * 0.035, 0.42) } }}
                  exit={{ opacity: 0, x: -8, transition: { duration: 0.16, ease: ease.exit } }}
                  className={cn(
                    'relative flex items-start gap-3.5 overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-200 hover:shadow-md',
                    alert.isRead ? 'border-border/60' : 'border-border hover:border-border-strong',
                  )}
                >
                  {!alert.isRead && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-y-3 start-0 w-[3px] rounded-e-full',
                        alert.severity === 'critical'
                          ? 'bg-destructive'
                          : alert.severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-info',
                      )}
                    />
                  )}
                  {body}
                  <span className="flex shrink-0 items-center gap-1.5">
                    {!alert.isRead && (
                      <button
                        type="button"
                        onClick={() => void markRead(alert.id)}
                        aria-label={t('markRead', { default: 'Mark read' })}
                        title={t('markRead', { default: 'Mark read' })}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                    {alert.href && (
                      <a
                        href={alert.href}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                        aria-label={t('investigate', { default: 'Investigate' })}
                        title={t('investigate', { default: 'Investigate' })}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </span>
                </m.li>
              );
            })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
