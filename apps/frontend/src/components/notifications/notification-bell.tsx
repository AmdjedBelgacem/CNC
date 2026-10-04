'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell,
  BellOff,
  CheckCheck,
  Inbox,
  Loader2,
  RefreshCw,
  Settings,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/use-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationSocket } from '@/components/providers/notification-socket-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { positionBelow, triggerBox, visibleViewport, type OverlayPosition } from '@/lib/overlay-position';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NotificationItem } from '@/components/notifications/notification-item';
import type { Notification } from '@/lib/api/types';

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<OverlayPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const tnav = useTranslations('nav');
  const locale = useLocale();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const enabled = hydrated && isAuthenticated;
  const { notifications, isLoading, isError, error, refetch, isFetching } = useNotifications({
    pollMs: 20_000,
    enabled: enabled && open,
    limit: 6,
  });
  const unreadQuery = useUnreadCount(enabled, 20_000);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { connected, reconnecting } = useNotificationSocket();
  const unreadCount = unreadQuery.data ?? notifications.filter((item) => !item.isRead).length;
  const formattedUnreadCount = formatNumber(unreadCount, locale);
  const liveLabel = connected ? t('liveOn') : reconnecting ? t('reconnecting') : t('polling');

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        setPanelPosition(null);
        return;
      }
      // Physical coordinates only: see src/lib/overlay-position.ts for why a logical
      // `start`/`end` put this panel on the wrong side under dir="rtl".
      const box = positionBelow(
        triggerBox(trigger.getBoundingClientRect()),
        visibleViewport(),
      );
      setPanelPosition(box);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  /**
   * `.dialog-pop` centres every dialog with `translate: -50% -50%`. That is the CSS
   * `translate` property, not `transform`, so `!translate-x-0` utilities do not dislodge
   * it and the panel renders half its own width/height off-position: it measured at
   * left:872/top:64 but painted at x:662/y:-276 on desktop, and the mobile full-screen
   * fallback painted at x:-195/y:-422 — entirely off-screen.
   *
   * Both branches position the panel in absolute coordinates (measured on desktop,
   * full-bleed on mobile), so the centring must be off in both cases, hence inline
   * rather than a class.
   */
  const panelStyle = {
    ...(panelPosition
      ? {
          '--panel-left': `${panelPosition.left}px`,
          '--panel-top': `${panelPosition.top}px`,
          '--panel-width': `${panelPosition.width}px`,
          '--panel-height': `${panelPosition.height}px`,
        }
      : {}),
    translate: 'none',
  } as CSSProperties;

  const onMarkRead = async (notification: Notification) => {
    try {
      await markRead.mutateAsync(notification.id);
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast({ type: 'ok', title: t('markAllRead') });
    } catch {
      toast({ type: 'err', title: tc('error') });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('title')}
          disabled={!isAuthenticated}
          className={cn('relative', className)}
        >
          <Bell aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-live="polite"
              aria-label={`${formattedUnreadCount} ${t('unread')}`}
              className="absolute -end-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold leading-none text-destructive-foreground ring-2 ring-background"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent
        hideClose
        title={t('title')}
        className={cn(
          'p-0 data-[state=open]:animate-fade-in-up',
          // Single measured layout for every viewport. The previous mobile fallback used a
          // separate full-bleed CSS branch (`w-full` + `left-0 right-0`), which rendered
          // off-screen at some widths and diverged from the desktop behaviour.
          '!left-[var(--panel-left)] !top-[var(--panel-top)] !h-[var(--panel-height)] !w-[var(--panel-width)] !max-h-none !max-w-none'
        )}
        style={panelStyle}
        overlayClassName="!bg-black/35 !backdrop-blur-0"
      >
        <DialogHeader className="shrink-0 gap-3 border-b border-border bg-card px-4 py-4 pe-14 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {t('title')} / {liveLabel}
            </p>
            {isFetching && !isLoading && (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label={tc('loading')}
              />
            )}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-xl font-semibold tracking-tight">
                {t('title')}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {unreadCount > 0
                  ? `${formattedUnreadCount} ${t('unread').toLowerCase()}`
                  : t('subtitle')}
              </DialogDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onMarkAll()}
                loading={markAllRead.isPending}
                className="shrink-0"
              >
                <CheckCheck aria-hidden />
                <span className="hidden sm:inline">{t('markAllRead')}</span>
                <span className="sm:hidden">{t('read')}</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken/25">
          {isLoading ? (
            <div className="space-y-3 p-4" role="status" aria-busy aria-label={tc('loading')}>
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="space-y-3 border-b border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-sm" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-4/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  </div>
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div
              className="flex min-h-80 flex-col items-center justify-center px-6 text-center"
              role="alert"
            >
              <span className="flex size-12 items-center justify-center rounded-sm border border-destructive/25 bg-destructive/10 text-destructive">
                <TriangleAlert className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-semibold">{t('loadFailed')}</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                {error instanceof Error ? error.message : tc('error')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                className="mt-4"
              >
                <RefreshCw aria-hidden />
                {tc('retry')}
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-xs">
                <BellOff className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-semibold">{t('empty')}</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                {t('emptyHint')}
              </p>
            </div>
          ) : (
            <ul aria-label={t('title')}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={onMarkRead}
                  onNavigate={() => setOpen(false)}
                  markPending={markRead.isPending}
                  compact
                />
              ))}
            </ul>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 border-t border-border bg-card">
          <Button
            asChild
            variant="ghost"
            className="rounded-none border-e border-border py-3"
            onClick={() => setOpen(false)}
          >
            <Link href="/notifications">
              <Inbox aria-hidden />
              {tc('viewAll')}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-none py-3"
            onClick={() => setOpen(false)}
          >
            <Link href="/settings/preferences/notifications">
              <Settings aria-hidden />
              {tnav('settings')}
            </Link>
          </Button>
        </div>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tc('close')}
            className="absolute end-3 top-3"
          >
            <X aria-hidden />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
