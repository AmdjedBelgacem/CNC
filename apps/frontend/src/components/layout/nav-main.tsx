'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, Search, LogOut, User, Bell, BookOpen, MessageCircle, Settings, Shield, LayoutTemplate } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { openPublicSearch } from '@/components/search/public-search-palette';
import { Button } from '@/components/ui/button';

const navKeys = [
  { key: 'academies', link: '/academy' },
  { key: 'toolkits', link: '/products' },
  { key: 'resources', link: '/feed' },
  { key: 'events', link: '/events' },
] as const;

export function NavMain() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout, impersonating } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHasHydrated(true), []);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    const controller = new AbortController();
    apiProxyFetch('/api/proxy/notifications/unread-count', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data !== null) setUnreadCount(data.count ?? data ?? 0);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [hasHydrated, isAuthenticated]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const showAuthenticated = hasHydrated && isAuthenticated;
  void user;
  const isAdmin =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    !!user?.tenantRoles?.some((r) => r.role === 'super_admin' || r.role === 'admin');
  const tNav = useTranslations('nav');
  const navItems = navKeys.map((k) => ({ name: tNav(k.key), link: k.link }));

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    logout();
    router.push('/');
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-xl font-semibold text-violet-600 dark:text-violet-400"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed] text-xs font-black text-white">
              AC
            </span>
            Ahmad CNC
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.link}
                href={item.link}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${pathname.startsWith(item.link) ? 'bg-violet-600/10 text-violet-600 dark:text-violet-400' : 'text-muted-foreground hover:text-violet-600 dark:text-violet-400'}`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Search" onClick={openPublicSearch}>
            <Search className="h-4 w-4" />
          </Button>
          {impersonating && (
            <span className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-600">
              Impersonating
            </span>
          )}
          {showAuthenticated ? (
            <>
              <Button variant="ghost" size="icon" aria-label="Messages" asChild>
                <Link href="/messages">
                  <MessageCircle className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
                asChild
              >
                <Link href="/notifications">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full bg-muted px-2 py-1.5 text-sm font-medium"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {user?.name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      '?'}
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[280px] overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="flex gap-2.5 px-4 pb-3 pt-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user?.name || 'User'}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        ) : (
                          <span>{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{user?.name || 'User'}</p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <div className="px-1.5 pb-1">
                      {/* `/profile/[userId]` is id-addressed; the username-addressed
                          public profile lives at `/u/[username]`. */}
                      <Link
                        href={`/profile/${user?.id}`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      >
                        <User className="h-3.5 w-3.5" />
                        Profile
                      </Link>
                      <Link
                        href="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        My learning
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </Link>
                      <Link
                        href="/settings/account/security"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Security
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-600/10"
                        >
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          {tNav('admin')}
                        </Link>
                      )}
                    </div>
                    <div className="border-t p-1.5">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register" className="gap-2">
                  Get Started <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
      </div>
      {isMobileMenuOpen && (
        <div className="border-t border-border bg-card p-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.link}
                href={item.link}
                onClick={closeMobileMenu}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${pathname.startsWith(item.link) ? 'bg-violet-600/10 text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
