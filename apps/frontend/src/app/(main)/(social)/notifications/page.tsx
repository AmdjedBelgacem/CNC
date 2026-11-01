'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { Crossfade, Reveal } from '@/components/ui/motion';
import { spring, transition } from '@/lib/motion';
import { useLocale, useTranslations } from 'next-intl';
import {
  AtSign,
  Bell,
  BellOff,
  BookOpen,
  Calendar,
  CheckCheck,
  Heart,
  Info,
  Loader2,
  MessageCircle,
  Radio,
  Shield,
  ShoppingBag,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { useNotificationSocket } from '@/components/providers/notification-socket-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { formatDate, timeAgo } from '@/lib/format';
import { safeInternalHref } from '@/lib/safe-href';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/api/types';

const TYPE_ICON: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  message: MessageCircle,
  direct_message: MessageCircle,
  dm_message: MessageCircle,
  course: BookOpen,
  lesson: BookOpen,
  enrollment: BookOpen,
  certificate: BookOpen,
  certificate_issued: BookOpen,
  course_completed: BookOpen,
  course_completion: BookOpen,
  order: ShoppingBag,
  order_created: ShoppingBag,
  order_confirmed: ShoppingBag,
  purchase: ShoppingBag,
  payment_succeeded: ShoppingBag,
  payment_failed: ShoppingBag,
  event: Calendar,
  security: Shield,
  system: Info,
};

function hrefFor(notification: Notification): string | null {
  if (notification.href) return notification.href;
  const data = notification.data ?? {};
  const candidate =
    data.href ??
    data.url ??
    data.path ??
    (typeof data.slug === 'string' ? `/courses/${encodeURIComponent(data.slug)}` : undefined) ??
    (typeof data.postId === 'string' ? `/feed?post=${encodeURIComponent(data.postId)}` : undefined) ??
    (typeof data.courseSlug === 'string' ? `/courses/${encodeURIComponent(data.courseSlug)}` : undefined);
  return safeInternalHref(candidate);
}

function localDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupNotifications(items: Notification[], locale: string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayKey = localDayKey(today);
  const yesterdayKey = localDayKey(yesterday);
  const groups: { key: string; label: string; items: Notification[] }[] = [];
  for (const item of items) {
    const key = localDayKey(item.createdAt);
    let label = formatDate(item.createdAt, locale, { dateStyle: 'medium' });
    if (key === todayKey) label = 'today';
    if (key === yesterdayKey) label = 'yesterday';
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.items.push(item);
    else groups.push({ key, label, items: [item] });
  }
  return groups;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const locale = useLocale();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const enabled = hydrated && isAuthenticated;
  const {
    notifications,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    hasMore,
    isLoadingNextPage,
    loadMore,
  } = useNotifications({ pollMs: 20_000, enabled, limit: 20, unreadOnly: filter === 'unread' });
  const unreadQuery = useUnreadCount(enabled, 20_000);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { connected, reconnecting } = useNotificationSocket();

  const unreadCount = unreadQuery.data ?? notifications.filter((item) => !item.isRead).length;
  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications),
    [filter, notifications],
  );
  const groups = useMemo(() => groupNotifications(visible, locale), [locale, visible]);

  const onMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast({ type: 'ok', title: t('markAllRead') });
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };

  const onMarkOne = async (notification: Notification) => {
    if (notification.isRead) return;
    try {
      await markRead.mutateAsync(notification.id);
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-10 sm:px-6 lg:py-14">
        <Skeleton className="h-10 w-56" />
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <EmptyState
          icon={Bell}
          title={t('signInTitle')}
          description={t('signInHint')}
          action={
            <Button asChild>
              <Link href="/login?returnUrl=%2Fnotifications">{tc('signIn')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const liveLabel = connected ? t('liveOn') : reconnecting ? t('reconnecting') : t('polling');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <Reveal as="header" className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
            {t('title')}
            {isFetching && !isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} ${t('unread').toLowerCase()} · ${liveLabel}` : t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              connected ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
            )}
          >
            <Radio className="size-3.5" />
            {liveLabel}
          </span>
          <AnimatePresence initial={false}>
            {unreadCount > 0 && (
              <m.div
                key="mark-all"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1, transition: spring.smooth }}
                exit={{ opacity: 0, scale: 0.95, transition: transition.leave }}
              >
                <Button variant="outline" size="sm" onClick={() => void onMarkAll()} loading={markAllRead.isPending}>
                  <CheckCheck />
                  {t('markAllRead')}
                </Button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread')}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">{tc('all')}</TabsTrigger>
          <TabsTrigger value="unread">
            {t('unread')}
            {unreadCount > 0 && (
              <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 text-2xs font-semibold tabular-nums text-primary">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Crossfade value={`${filter}-${isLoading ? 'l' : isError ? 'e' : visible.length === 0 ? '0' : 'list'}`} axis="none">
      {isLoading ? (
        <div className="space-y-2" role="status" aria-busy>
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <ErrorState title={t('loadFailed')} description={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={filter === 'unread' ? BellOff : Bell}
          title={filter === 'unread' ? t('read') : t('empty')}
          description={t('emptyHint')}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <m.section
              key={group.key}
              layout="position"
              transition={spring.layout}
              aria-labelledby={`notification-group-${group.key}`}
            >
              <h2 id={`notification-group-${group.key}`} className="mb-3 px-1 text-xs font-medium text-muted-foreground">
                {group.label === 'today' ? tc('today') : group.label === 'yesterday' ? tc('yesterday') : group.label}
              </h2>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                {group.items.map((notification) => {
                  const Icon = TYPE_ICON[notification.type] ?? Bell;
                  const href = hrefFor(notification);
                  const body = (
                    <>
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                          notification.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className={cn('truncate text-sm transition-colors', notification.isRead ? 'text-muted-foreground' : 'font-medium text-foreground')}>
                            {notification.title}
                          </span>
                          <AnimatePresence initial={false}>
                            {!notification.isRead && (
                              <m.span
                                key="dot"
                                aria-hidden
                                initial={{ scale: 0 }}
                                animate={{ scale: 1, transition: spring.snappy }}
                                exit={{ scale: 0, opacity: 0, transition: transition.leave }}
                                className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                              />
                            )}
                          </AnimatePresence>
                        </span>
                        {notification.body && <span className="mt-0.5 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">{notification.body}</span>}
                        <span className="mt-1.5 block text-xs text-muted-foreground">{timeAgo(notification.createdAt, locale)}</span>
                      </span>
                    </>
                  );
                  return (
                    <m.li
                      key={notification.id}
                      layout="position"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: transition.enter }}
                      exit={{ opacity: 0, x: 16, transition: transition.leave }}
                      transition={spring.layout}
                    >
                      <div
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3.5 shadow-xs transition-[background-color,border-color,box-shadow] duration-300 hover:shadow-md sm:p-4',
                          notification.isRead ? 'border-border/70 bg-card' : 'border-primary/20 bg-primary/[0.04]',
                        )}
                      >
                        {href ? (
                          <Link href={href} onClick={() => void onMarkOne(notification)} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-md">
                            {body}
                          </Link>
                        ) : (
                          <button type="button" onClick={() => void onMarkOne(notification)} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-md text-start">
                            {body}
                          </button>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('markRead')}
                            onClick={() => void onMarkOne(notification)}
                            disabled={markRead.isPending}
                          >
                            <CheckCheck />
                          </Button>
                        )}
                      </div>
                    </m.li>
                  );
                })}
                </AnimatePresence>
              </ul>
            </m.section>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => void loadMore()} loading={isLoadingNextPage}>
                {tc('showMore')}
              </Button>
            </div>
          )}
        </div>
      )}
      </Crossfade>
    </div>
  );
}
