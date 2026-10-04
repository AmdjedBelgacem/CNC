'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { usePlatformAlertUnread } from '@/hooks/use-platform-alerts';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The admin console's notification icon.
 *
 * For a super admin this is a link to the platform feed rather than a personal
 * dropdown: inside the admin panel, "notifications" means the cross-tenant
 * operational signal, and the badge counts that feed so the number the operator
 * sees is the number the destination shows. Personal notifications stay on the
 * bell in the main application shell, which serves learners and staff.
 */
export function PlatformAlertsRailBell({ className }: { className?: string }) {
  const t = useTranslations('admin.platformAlerts');
  const tc = useTranslations('common');
  const locale = useLocale();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { unreadCount } = usePlatformAlertUnread(hydrated && isAuthenticated, 30_000);
  const formatted = formatNumber(unreadCount, locale);

  return (
    <Link
      href="/admin/alerts"
      title={t('title')}
      aria-label={
        unreadCount > 0
          ? `${formatted} ${tc('unread', { default: 'unread' })} · ${t('title')}`
          : t('title')
      }
      className={cn(
        'relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Bell aria-hidden className="size-[18px]" />
      {unreadCount > 0 && (
        <span
          aria-live="polite"
          className="absolute -end-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold leading-none text-destructive-foreground ring-2 ring-background"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
