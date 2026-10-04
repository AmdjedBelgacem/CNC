'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
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
          'sticky top-0 z-40 w-full bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75',
          // Transitioning only the two properties that change keeps this off the
          // layout path — no reflow while scrolling.
          'transition-[border-color,box-shadow] duration-200',
          lifted ? 'border-b border-border shadow-xs' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMark />

          {/* Desktop nav: managed tree, hairline active indicator at the lower edge. */}
          <SiteNavDesktop items={items} />

          <div className="ms-auto flex items-center gap-1">
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
                    className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground tabular-nums"
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {impersonating && (
              <span className="hidden rounded-sm bg-warning/15 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-warning sm:inline-flex">
                Impersonating
              </span>
            )}

            {showAuthenticated ? (
              <>
                <NotificationBell />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t('profile')}
                      className="rounded-full ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar className="size-8 rounded-sm">
                        {user?.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={user?.name || 'User'} />
                        )}
                        <AvatarFallback className="rounded-sm font-mono text-xs">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="normal-case">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {user?.name || 'User'}
                      </span>
                      <span className="block truncate font-mono text-xs font-normal text-muted-foreground">
                        {user?.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
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
              <div className="hidden items-center gap-2 lg:flex">
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
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Inline expanding panel — left-edge active marker, route mono labels. */}
        {/* The panel expands the header rather than overlaying it, so the page
            below doesn't have to be padded to compensate. Height is animated
            because it is a layout property — but the panel is short and the
            header is already sticky, so the reflow is contained. */}
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <m.div
              key="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: spring.gentle }}
              exit={{ height: 0, opacity: 0, transition: transition.leave }}
              className="overflow-hidden border-t border-border bg-background md:hidden"
            >
              <nav
                className="mx-auto flex max-w-7xl flex-col gap-0.5 px-4 py-3"
                aria-label="Mobile"
              >
                <SiteNavMobile items={items} onNavigate={() => setMobileOpen(false)} />
                {!showAuthenticated && (
                  <div className="mt-2 flex gap-2">
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
                    className="mt-2 justify-start"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut />
                    {t('signOut')}
                  </Button>
                )}
                <Button variant="outline" className="mt-2 justify-start" asChild>
                  <Link href="/cart">
                    <ShoppingCart className="size-4" />
                    {tp('cart')}
                    {hasHydrated && cartCount > 0 ? ` (${cartCount})` : ''}
                  </Link>
                </Button>
                <div className="mt-2 flex items-center justify-between rounded-md border border-border px-3 py-2 md:hidden">
                  <span className="text-sm text-muted-foreground">{t('toggleTheme')}</span>
                  <ThemeToggle />
                </div>
              </nav>
            </m.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
