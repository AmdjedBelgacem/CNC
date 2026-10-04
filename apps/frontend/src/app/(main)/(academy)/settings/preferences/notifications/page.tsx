'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Bell,
  GraduationCap,
  Mail,
  MessageSquare,
  Shield,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  NOTIFICATION_CATEGORIES,
  useNotificationPreferences,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/hooks/use-notification-preferences';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';

const CATEGORY_META: Record<
  NotificationCategory,
  { icon: typeof Users; title: string; description: string }
> = {
  social: { icon: Users, title: 'social', description: 'socialDescription' },
  learning: { icon: GraduationCap, title: 'learning', description: 'learningDescription' },
  commerce: { icon: ShoppingBag, title: 'commerce', description: 'commerceDescription' },
  security: { icon: Shield, title: 'security', description: 'securityDescription' },
};

function samePreferences(left: NotificationPreferences, right: NotificationPreferences): boolean {
  return NOTIFICATION_CATEGORIES.every(
    (category) =>
      left.inAppNotifications[category] === right.inAppNotifications[category] &&
      left.emailNotifications[category] === right.emailNotifications[category],
  );
}

export default function NotificationPreferencesPage() {
  const t = useTranslations('notificationPreferences');
  const tc = useTranslations('common');
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const enabled = hydrated && isAuthenticated;
  const { preferences, isLoading, isError, error, refetch, savePreferences, isSaving, saveError } =
    useNotificationPreferences(enabled);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (preferences) setDraft(preferences);
  }, [preferences]);

  const dirty = useMemo(
    () => !!draft && !!preferences && !samePreferences(draft, preferences),
    [draft, preferences],
  );
  const allOn = useMemo(
    () =>
      !!draft &&
      NOTIFICATION_CATEGORIES.every(
        (category) => draft.inAppNotifications[category] && draft.emailNotifications[category],
      ),
    [draft],
  );

  const updateChannel = (
    channel: keyof NotificationPreferences,
    category: NotificationCategory,
    value: boolean,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            [channel]: { ...current[channel], [category]: value },
          }
        : current,
    );
  };

  const toggleAll = (value: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current };
      for (const channel of ['inAppNotifications', 'emailNotifications'] as const) {
        next[channel] = { ...next[channel] };
        for (const category of NOTIFICATION_CATEGORIES) next[channel][category] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await savePreferences(draft);
      toast({ type: 'ok', title: t('saved') });
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={Bell}
        title={t('signInTitle')}
        description={t('signInHint')}
        action={
          <Button asChild>
            <Link href="/login?returnUrl=%2Fsettings%2Fpreferences%2Fnotifications">{tc('signIn')}</Link>
          </Button>
        }
      />
    );
  }

  if (isError) {
    return <ErrorState title={t('loadFailed')} description={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />;
  }

  if (isLoading || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const renderChannel = (channel: keyof NotificationPreferences, title: string, icon: ElementType) => {
    const ChannelIcon = icon;
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-6 py-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
            <ChannelIcon className="size-3.5" />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="divide-y divide-border/60">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <div key={category} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-muted/20">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(meta.title)}</p>
                    <p className="text-xs text-muted-foreground">{t(meta.description)}</p>
                  </div>
                </div>
                <Switch
                  checked={draft[channel][category]}
                  onCheckedChange={(value) => updateChannel(channel, category, value)}
                  aria-label={t(meta.title)}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toggleAll(!allOn)} className="hidden sm:inline-flex">
          {allOn ? t('disableAll') : t('enableAll')}
        </Button>
      </div>

      {saveError && <ErrorState compact title={t('saveFailed')} description={saveError instanceof Error ? saveError.message : undefined} />}

      <div className="space-y-6">
        {renderChannel('emailNotifications', t('emailTitle'), Mail)}
        {renderChannel('inAppNotifications', t('inAppTitle'), MessageSquare)}
      </div>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        <span className="text-xs text-muted-foreground">{dirty ? t('unsaved') : t('savedHint')}</span>
        <Button onClick={() => void handleSave()} disabled={!dirty} loading={isSaving}>
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
