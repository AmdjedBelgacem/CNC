'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  AtSign,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  Heart,
  Info,
  MessageCircle,
  PackageCheck,
  Shield,
  ShoppingBag,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, timeAgo } from '@/lib/format';
import { safeInternalHref } from '@/lib/safe-href';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/api/types';

export type NotificationCategory = 'social' | 'learning' | 'commerce' | 'security' | 'system';

const CATEGORY_KEYS: NotificationCategory[] = [
  'social',
  'learning',
  'commerce',
  'security',
  'system',
];

const TYPE_CATEGORY: Record<string, NotificationCategory> = {
  like: 'social',
  comment: 'social',
  follow: 'social',
  mention: 'social',
  message: 'social',
  direct_message: 'social',
  dm_message: 'social',
  event: 'social',
  course: 'learning',
  lesson: 'learning',
  enrollment: 'learning',
  certificate: 'learning',
  certificate_issued: 'learning',
  course_completed: 'learning',
  course_completion: 'learning',
  order: 'commerce',
  order_created: 'commerce',
  order_confirmed: 'commerce',
  purchase: 'commerce',
  payment_succeeded: 'commerce',
  payment_failed: 'commerce',
  security: 'security',
  system: 'system',
};

const CATEGORY_TONE: Record<NotificationCategory, string> = {
  social: 'bg-primary/10 text-primary',
  learning: 'bg-accent/10 text-accent',
  commerce: 'bg-warning/10 text-warning',
  security: 'bg-destructive/10 text-destructive',
  system: 'bg-secondary/10 text-secondary',
};

function isCategory(value: string): value is NotificationCategory {
  return CATEGORY_KEYS.some((key) => key === value);
}

export function getNotificationCategory(notification: Notification): NotificationCategory {
  const explicit = notification.category?.trim().toLowerCase();
  if (explicit && isCategory(explicit)) return explicit;
  const type = notification.type.trim().toLowerCase();
  if (TYPE_CATEGORY[type]) return TYPE_CATEGORY[type];
  if (type.includes('comment') || type.includes('mention') || type.includes('follow')) {
    return 'social';
  }
  if (type.includes('course') || type.includes('lesson') || type.includes('enroll')) {
    return 'learning';
  }
  if (
    type.includes('order') ||
    type.includes('payment') ||
    type.includes('purchase') ||
    type.includes('commerce')
  ) {
    return 'commerce';
  }
  if (type.includes('security') || type.includes('account')) return 'security';
  return 'system';
}

function iconFor(type: string) {
  const value = type.trim().toLowerCase();
  if (value.includes('like')) return Heart;
  if (value.includes('comment') || value.includes('message')) return MessageCircle;
  if (value.includes('follow')) return UserPlus;
  if (value.includes('mention')) return AtSign;
  if (
    value.includes('course') ||
    value.includes('lesson') ||
    value.includes('certificate') ||
    value.includes('enroll')
  ) {
    return BookOpen;
  }
  if (value.includes('payment')) return PackageCheck;
  if (value.includes('order') || value.includes('purchase')) return ShoppingBag;
  if (value.includes('event')) return CalendarDays;
  if (value.includes('security')) return Shield;
  if (value.includes('system')) return Info;
  return Bell;
}

function hrefFor(notification: Notification): string | null {
  if (notification.href) return safeInternalHref(notification.href);
  if (notification.actionUrl) return safeInternalHref(notification.actionUrl);
  const data = notification.data ?? {};
  const candidate =
    data.href ??
    data.url ??
    data.path ??
    (typeof data.username === 'string' ? `/u/${encodeURIComponent(data.username)}` : undefined) ??
    (typeof data.slug === 'string' ? `/courses/${encodeURIComponent(data.slug)}` : undefined) ??
    (typeof data.postId === 'string'
      ? `/feed?post=${encodeURIComponent(data.postId)}`
      : undefined) ??
    (typeof data.courseSlug === 'string'
      ? `/courses/${encodeURIComponent(data.courseSlug)}`
      : undefined);
  return safeInternalHref(candidate);
}

export interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (notification: Notification) => void | Promise<void>;
  onNavigate?: () => void;
  markPending?: boolean;
  showCategory?: boolean;
  compact?: boolean;
  className?: string;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
  markPending = false,
  showCategory = false,
  compact = false,
  className,
}: NotificationItemProps) {
  const t = useTranslations('notifications');
  const tp = useTranslations('notificationPreferences');
  const locale = useLocale();
  const category = getNotificationCategory(notification);
  const Icon = iconFor(notification.type);
  const href = hrefFor(notification);
  const categoryLabel = category === 'system' ? t('typeSystem') : tp(category);
  const markRead = () => {
    if (notification.isRead || !onMarkRead) return;
    void onMarkRead(notification);
  };
  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex items-start gap-2">
        <h3
          className={cn(
            'min-w-0 text-sm leading-snug',
            compact ? 'line-clamp-2' : 'sm:text-[15px]',
            notification.isRead
              ? 'font-medium text-foreground/80'
              : 'font-semibold text-foreground',
          )}
        >
          {notification.title}
        </h3>
        <span className="sr-only">{notification.isRead ? t('read') : t('unread')}</span>
        <span
          aria-hidden
          className={cn(
            'mt-1.5 size-1.5 shrink-0 rounded-full',
            notification.isRead ? 'bg-border-strong' : 'bg-primary',
          )}
        />
      </div>
      {notification.body && (
        <p
          className={cn(
            'mt-1 text-xs leading-relaxed text-muted-foreground',
            compact ? 'line-clamp-2' : 'line-clamp-3 sm:text-[13px]',
          )}
        >
          {notification.body}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {showCategory && (
          <Badge variant="outline" className="border-border-strong/70 text-muted-foreground">
            {categoryLabel}
          </Badge>
        )}
        <time
          dateTime={notification.createdAt}
          title={formatDateTime(notification.createdAt, locale) || undefined}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          {timeAgo(notification.createdAt, locale)}
        </time>
      </div>
    </div>
  );

  return (
    <li className={cn('group relative min-w-0', className)}>
      <article
        className={cn(
          'relative flex min-w-0 items-start gap-3 overflow-hidden border-b border-border transition-colors',
          compact ? 'gap-2.5 px-4 py-3.5' : 'px-4 py-4 sm:px-5 sm:py-5',
          notification.isRead
            ? 'bg-card/50 hover:bg-muted/25'
            : 'bg-primary/[0.035] hover:bg-primary/[0.065]',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 start-0 w-[3px]',
            notification.isRead ? 'bg-transparent' : 'bg-primary',
          )}
        />
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-sm border',
            compact ? 'size-9' : 'size-10 sm:size-11',
            notification.isRead
              ? 'border-border bg-muted/60 text-muted-foreground'
              : cn('border-current/15 bg-card shadow-xs', CATEGORY_TONE[category]),
          )}
        >
          <Icon className={compact ? 'size-4' : 'size-[18px]'} aria-hidden />
        </span>
        {href ? (
          <Link
            href={href}
            onClick={() => {
              markRead();
              onNavigate?.();
            }}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {body}
          </Link>
        ) : (
          body
        )}
        {!notification.isRead && onMarkRead && (
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'icon-xs' : 'icon-sm'}
            aria-label={t('markRead')}
            title={t('markRead')}
            onClick={markRead}
            disabled={markPending}
            className="shrink-0 text-muted-foreground opacity-100 hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <CheckCheck aria-hidden />
          </Button>
        )}
        {href && (
          <ArrowUpRight
            aria-hidden
            className="mt-0.5 hidden size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary sm:block"
          />
        )}
      </article>
    </li>
  );
}
