'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { dialogMotion } from '@/components/ui/dialog';
import { Stagger } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';
import { useCartStore } from '@/stores/cart-store';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import { NavbarSearch } from '@/components/search/navbar-search';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { BrandMark } from '@/components/layout/brand';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiteNavDesktop, SiteNavMobile } from '@/components/layout/site-nav';
import type { NavItemView } from '@titan/shared';

export function NavMain({ items }: { items: NavItemView[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const tp = useTranslations('products');
  const tMessages = useTranslations('messages');
  const tEndImpersonation = useTranslations('nav.impersonation');
  // Shallow-compared rather than a whole-store read: the navbar sits in every
  // public layout, so re-rendering it on unrelated auth writes is the most
  // visible instance of the `` `set` is expensive `` problem.
  const { isAuthenticated, user, logout, impersonating } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      user: s.user,
      logout: s.logout,
      impersonating: s.impersonating,
    })),
  );
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  const [hasHydrated, setHasHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setHasHydrated(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  // The open mobile sheet behaves like a lightweight dialog: Escape closes it
  // and the page underneath stops scrolling while it is up.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  // ── Scroll-aware header ──────────────────────────────────────────────
  // The header is `sticky top-0`, so it is the first thing you see after the
  // announcement bar scrolls away. It stays borderless and shadowless while
  // you're at the top — the page's own top edge is the divider — and picks up a
  // hairline plus a soft shadow the moment content passes underneath it.
  //
  // The 8px threshold rather than 0: a scrollbar drag or trackpad nudge of a
  // pixel or two shouldn't make the chrome jump.
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Cart badge ───────────────────────────────────────────────────────
  // Springs on mount rather than appearing, so the first paint after adding to
  // the cart reads as a change instead of a stray dot.
  const badgeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (cartCount > 0)
      badgeRef.current?.animate(
        [
          { transform: 'scale(0.4)', opacity: 0 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 320, easing: 'cubic-bezier(0.32,0.72,0,1)' },
      );
  }, [cartCount]);

  const showAuthenticated = hasHydrated && isAuthenticated;
  const isAdmin =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    !!user?.tenantRoles?.some((r) => r.role === 'super_admin' || r.role === 'admin');

  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* signed out locally regardless */
    }
    logout();
    router.push('/');
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full',
          // Transitioning only paint properties keeps this off the layout path —
          // no reflow while scrolling. At rest the bar is part of the page; once
          // content slides beneath it, it lifts into a frosted paper strip.
          'transition-[background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          mobileOpen
            ? 'border-b border-border/70 bg-background'
            : lifted
              ? 'border-b border-border/70 bg-background/80 shadow-sm backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/70'
              : 'border-b border-transparent bg-background',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-6 sm:px-6 lg:px-8">
          <BrandMark />

          {/* Desktop nav: managed tree with a sliding hover pill and clay active rule. */}
          <SiteNavDesktop items={items} />

          {/* Tight on phones: six 40px controls plus a roomy gap pushed the page 19px past a 375px screen. */}
          <div className="ms-auto flex items-center gap-0 sm:gap-1">
            <NavbarSearch />

            <LocaleSwitcher />
            {/* On phones the theme toggle lives in the mobile menu panel. */}
            <div className="hidden md:inline-flex">
              <ThemeToggle />
            </div>

            <Button
              variant="ghost"
              size="icon"
              asChild
              className="relative"
              aria-label={cartCount > 0 ? `${tp('cart')} (${cartCount})` : tp('cart')}
            >
              <Link href="/cart">
                <ShoppingCart className="size-4" />
                {hasHydrated && cartCount > 0 && (
                  <span
                    ref={badgeRef}
                    className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums ring-2 ring-background"
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {/*
              The badge told you that you were impersonating but gave you no way out:
              `/admin/impersonate/end` existed on the server and nothing in the UI called
              it, so the session had to be cleared by hand. It is now the control.
            */}
            {impersonating && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.post('/admin/impersonate/end');
                    window.location.href = '/admin';
                  } catch {
                    toast({ type: 'err', title: tEndImpersonation('failed') });
                  }
                }}
                title={tEndImpersonation('title')}
                className="hidden items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/20 sm:inline-flex"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                {tEndImpersonation('badge')}
                <X className="size-3" />
              </button>
            )}

            {showAuthenticated ? (
              <>
                <NotificationBell />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t('profile')}
                      className="ms-1 rounded-full ring-offset-2 ring-offset-background transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                    >
                      <Avatar className="size-8 rounded-full ring-1 ring-border">
                        {user?.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user?.name || 'User'} />
                        )}
                        <AvatarFallback className="rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="normal-case">
                      <span className="block truncate font-display text-[15px] font-medium text-foreground">
                        {user?.name || 'User'}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {user?.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => router.push('/messages')}>
                      <MessageSquare />
                      {tMessages('nav')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.push('/learning')}>
                      <BookOpen />
                      {t('myLearning')}
                    </DropdownMenuItem>
                    {user?.id && (
                      <DropdownMenuItem onSelect={() => router.push(`/profile/${user.id}`)}>
                        <User />
                        {t('profile')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => router.push('/settings')}>
                      <Settings />
                      {t('settings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.push('/settings/account/security')}>
                      <Shield />
                      {t('security')}
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => router.push('/admin')}>
                          <LayoutDashboard />
                          {t('admin')}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
                      <LogOut />
                      {t('signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="ms-2 hidden items-center gap-1.5 lg:flex">
                <Button variant="ghost" asChild>
                  <Link href="/login">{t('signIn')}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t('getStarted')}</Link>
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {/* The two icons trade places with a quarter turn rather than snapping. */}
              <AnimatePresence mode="wait" initial={false}>
                <m.span
                  key={mobileOpen ? 'close' : 'open'}
                  className="flex"
                  initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1, transition: spring.snappy }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.8, transition: { duration: 0.1 } }}
                >
                  {mobileOpen ? <X /> : <Menu />}
                </m.span>
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* Mobile sheet. It drops out of the header as a rounded paper panel
            over a soft scrim (rendered outside the header below, because the
            header's backdrop-filter would otherwise become the containing block
            for a `fixed` scrim). Rows cascade in; the panel scrolls on its own
            if the menu is taller than the viewport. */}
        <AnimatePresence>
          {mobileOpen && (
            <m.div
              key="mobile-nav"
              id="mobile-nav-panel"
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
              exit={{ opacity: 0, y: -6, scale: 0.99, transition: transition.leave }}
              style={{ transformOrigin: 'top center' }}
              className="absolute inset-x-3 top-full z-50 mt-2 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-card shadow-xl md:hidden"
            >
              <nav aria-label="Mobile">
                {items.length > 0 && (
                  <Stagger
                    gap={0.035}
                    maxDelay={0.3}
                    className="flex flex-col gap-0.5 border-b border-border/70 p-2"
                  >
                    <SiteNavMobile items={items} onNavigate={() => setMobileOpen(false)} />
                  </Stagger>
                )}
                <div className="flex flex-col gap-2 p-3">
                  {!showAuthenticated && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" asChild>
                        <Link href="/login">{t('signIn')}</Link>
                      </Button>
                      <Button className="flex-1" asChild>
                        <Link href="/register">{t('getStarted')}</Link>
                      </Button>
                    </div>
                  )}
                  {showAuthenticated && (
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => void handleLogout()}
                    >
                      <LogOut />
                      {t('signOut')}
                    </Button>
                  )}
                  <Button variant="outline" className="justify-start" asChild>
                    <Link href="/cart">
                      <ShoppingCart className="size-4" />
                      {tp('cart')}
                      {hasHydrated && cartCount > 0 ? ` (${cartCount})` : ''}
                    </Link>
                  </Button>
                  <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 md:hidden">
                    <span className="text-sm text-muted-foreground">{t('toggleTheme')}</span>
                    <ThemeToggle />
                  </div>
                </div>
              </nav>
            </m.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <m.div
            key="mobile-nav-scrim"
            aria-hidden
            {...dialogMotion.overlay}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-overlay/45 backdrop-blur-[3px] md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
