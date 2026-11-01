'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';
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
        'group relative flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Bell
        aria-hidden
        className="size-[18px] origin-top transition-transform duration-200 group-hover:-rotate-12"
      />
      <AnimatePresence initial={false}>
        {unreadCount > 0 && (
          <m.span
            key="badge"
            aria-live="polite"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
            exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
            className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none tabular-nums text-primary-foreground ring-2 ring-surface-sunken"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </m.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
