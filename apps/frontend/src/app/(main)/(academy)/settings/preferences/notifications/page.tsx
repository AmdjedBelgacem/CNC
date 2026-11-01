'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, GraduationCap, Mail, MessageSquare, Shield, ShoppingBag, Users } from 'lucide-react';
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
import { Crossfade } from '@/components/ui/motion';
import {
  SettingsHeader,
  SettingsRow,
  SettingsSaveBar,
  SettingsSection,
} from '../../_components/settings-ui';

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
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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
            <Link href="/login?returnUrl=%2Fsettings%2Fpreferences%2Fnotifications">
              {tc('signIn')}
            </Link>
          </Button>
        }
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('loadFailed')}
        description={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const renderChannel = (
    channel: keyof NotificationPreferences,
    title: string,
    icon: ElementType,
    delay = 0,
  ) => (
    <SettingsSection
      icon={icon}
      title={title}
      delay={delay}
      bodyClassName="divide-y divide-border/60 p-0"
    >
      {NOTIFICATION_CATEGORIES.map((category) => {
        const meta = CATEGORY_META[category];
        return (
          <SettingsRow
            key={category}
            icon={meta.icon}
            title={t(meta.title)}
            description={t(meta.description)}
            control={
              <Switch
                checked={draft[channel][category]}
                onCheckedChange={(value) => updateChannel(channel, category, value)}
                aria-label={t(meta.title)}
              />
            }
          />
        );
      })}
    </SettingsSection>
  );

  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Bell}
        title={t('title')}
        subtitle={t('description')}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAll(!allOn)}
            className="hidden rounded-full sm:inline-flex"
          >
            {allOn ? t('disableAll') : t('enableAll')}
          </Button>
        }
      />

      {saveError && (
        <ErrorState
          compact
          title={t('saveFailed')}
          description={saveError instanceof Error ? saveError.message : undefined}
        />
      )}

      <div className="space-y-6">
        {renderChannel('emailNotifications', t('emailTitle'), Mail)}
        {renderChannel('inAppNotifications', t('inAppTitle'), MessageSquare, 0.05)}
      </div>

      <SettingsSaveBar className="justify-between">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`size-1.5 rounded-full transition-colors ${dirty ? 'bg-warning' : 'bg-success'}`}
            aria-hidden
          />
          <Crossfade value={dirty ? 'dirty' : 'clean'} axis="none">
            {dirty ? t('unsaved') : t('savedHint')}
          </Crossfade>
        </span>
        <Button
          onClick={() => void handleSave()}
          disabled={!dirty}
          loading={isSaving}
          className="rounded-full px-6"
        >
          {isSaving ? t('saving') : t('save')}
        </Button>
      </SettingsSaveBar>
    </div>
  );
}
