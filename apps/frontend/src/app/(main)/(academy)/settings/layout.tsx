'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  User,
  Shield,
  AlertTriangle,
  Bell,
  Palette,
  Eye,
  Link2,
  CreditCard,
  ChevronLeft,
  Menu,
  X,
  UserCircle,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dialogMotion } from '@/components/ui/dialog';
import { Crossfade } from '@/components/ui/motion';
import { ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('account');
  const pathname = usePathname();
  const tCommon = useTranslations('common');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The drawer docks at the inline-end edge (next to its trigger) and slides in
  // from there — the left-hand side under `dir=rtl`.
  const drawerOffset =
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? '-100%' : '100%';

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);
  const sidebarSections = [
    {
      label: t('nav.accountSection'),
      items: [
        {
          href: '/settings/account',
          icon: User,
          label: t('nav.general'),
          desc: t('nav.generalDesc'),
        },
        {
          href: '/settings/account/security',
          icon: Shield,
          label: t('nav.security'),
          desc: t('nav.securityDesc'),
        },
        {
          href: '/settings/account/danger',
          icon: AlertTriangle,
          label: t('nav.dangerZone'),
          desc: t('nav.dangerZoneDesc'),
        },
      ],
    },
    {
      label: t('nav.profileSection'),
      items: [
        {
          href: '/settings/profile',
          icon: UserCircle,
          label: t('nav.editProfile'),
          desc: t('nav.editProfileDesc'),
        },
      ],
    },
    {
      label: t('nav.preferencesSection'),
      items: [
        {
          href: '/settings/preferences/notifications',
          icon: Bell,
          label: t('nav.notifications'),
          desc: t('nav.notificationsDesc'),
        },
        {
          href: '/settings/preferences/appearance',
          icon: Palette,
          label: t('nav.appearance'),
          desc: t('nav.appearanceDesc'),
        },
        {
          href: '/settings/preferences/privacy',
          icon: Eye,
          label: t('nav.privacy'),
          desc: t('nav.privacyDesc'),
        },
      ],
    },
    {
      label: t('nav.connectionsSection'),
      items: [
        {
          href: '/settings/connected-accounts',
          icon: Link2,
          label: t('nav.connectedAccounts'),
          desc: t('nav.connectedAccountsDesc'),
        },
        {
          href: '/settings/billing',
          icon: CreditCard,
          label: t('nav.billing'),
          desc: t('nav.billingDesc'),
        },
      ],
    },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  // `/settings/account` is a prefix of its own sub-pages, so pick the longest
  // matching href — otherwise two items would both claim the indicator.
  const activeSection = sidebarSections
    .flatMap((s) => s.items)
    .filter((i) => isActive(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const renderNav = (variant: 'rail' | 'drawer') => (
    <nav className="space-y-6" aria-label={t('nav.settingsTitle')}>
      {sidebarSections.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{section.label}</p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = activeSection?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={variant === 'drawer' ? () => setSidebarOpen(false) : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                  )}
                >
                  {active && (
                    <m.span
                      layoutId={`settings-nav-active-${variant}`}
                      transition={spring.smooth}
                      className="absolute inset-0 rounded-lg border border-border/70 bg-card shadow-xs"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      'relative flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-4" />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs leading-snug text-muted-foreground">
                      {item.desc}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-6 lg:pt-12">
        <header className="flex items-end gap-4 border-b border-border/70 pb-6">
          <div className="min-w-0 flex-1">
            <Link
              href="/account"
              className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="flip-rtl size-3.5" /> {t('nav.dashboard')}
            </Link>
            <h1 className="font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl">
              {t('nav.settingsTitle')}
            </h1>
            <Crossfade value={activeSection?.href ?? 'none'} className="mt-1.5">
              <p className="truncate text-sm text-muted-foreground">
                {activeSection
                  ? activeSection.label + ' · ' + activeSection.desc
                  : t('nav.subtitleFallback')}
              </p>
            </Crossfade>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0 rounded-full lg:hidden"
            aria-label={t('nav.settingsTitle')}
            aria-expanded={sidebarOpen}
          >
            <Menu className="size-4" />
          </Button>
        </header>
      </div>
      <div className="mx-auto flex max-w-[1400px] gap-10 px-4 py-8 sm:px-6 xl:gap-14">
        {/* Desktop sidebar */}
        <aside className="hidden w-[260px] shrink-0 lg:block">
          <div className="sticky top-[96px] space-y-6">
            {renderNav('rail')}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <p className="mt-3 font-display text-base font-medium leading-tight text-foreground">
                {t('nav.needHelp')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('nav.helpHint')}
              </p>
              <Link
                href="/feed"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('nav.visitHelpCenter')}
              </Link>
            </div>
          </div>
        </aside>
        {/* Mobile drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" key="settings-drawer">
              <m.div
                className="absolute inset-0 bg-overlay/45 backdrop-blur-[3px]"
                onClick={() => setSidebarOpen(false)}
                aria-hidden
                {...dialogMotion.overlay}
              />
              <m.aside
                role="dialog"
                aria-modal="true"
                aria-label={t('nav.settingsTitle')}
                initial={{ x: drawerOffset }}
                animate={{ x: 0, transition: spring.gentle }}
                exit={{ x: drawerOffset, transition: { duration: 0.22, ease: ease.exit } }}
                className="absolute inset-y-0 end-0 flex w-[min(320px,88vw)] flex-col border-s border-border/70 bg-background shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                  <span className="flex items-center gap-2 font-display text-lg font-medium text-foreground">
                    <Settings className="size-4 text-primary" /> {t('nav.settingsTitle')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-full"
                    aria-label={tCommon('close')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-3">{renderNav('drawer')}</div>
              </m.aside>
            </div>
          )}
        </AnimatePresence>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
