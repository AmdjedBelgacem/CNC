'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ExternalLink,
  Cog,
  LayoutTemplate,
  Palette,
  LayoutDashboard,
  BarChart2,
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  Search,
  Award,
  UserCog,
  LogOut,
  Crosshair,
  Package,
  DollarSign,
  Mail,
  Navigation,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { openAdminSearch } from './admin-search-palette';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { PlatformAlertsRailBell } from '@/components/admin/platform-alerts-rail-bell';
const ADMIN_ROLES = ['super_admin', 'admin'];
/**
 * Nav groups.
 *
 * Fifteen undifferentiated icons told the reader nothing about why "Certificates" sits between
 * "Finance" and "Email". These are the actual shape of the console: what you author, who you
 * manage, what it earns, and how the site itself is configured. The order down the rail comes
 * from `tabsBase`, which lists the tabs group by group.
 */
type NavGroup = 'overview' | 'content' | 'people' | 'commerce' | 'platform';
/**
 * Rail order.
 *
 * `tabsBase` is grouped by convenience, not by where each entry belongs: Email and Navigation
 * sit right after Builder, while Academies, Courses and Products come much later. Rendering it
 * in file order shredded the groups — Platform items appeared above Content ones, and the
 * separator fired on every change, so the rail ended up with eight rules instead of four.
 * Sorting here makes each group contiguous regardless of how `tabsBase` is written.
 */
const NAV_GROUP_ORDER: NavGroup[] = ['overview', 'content', 'people', 'commerce', 'platform'];

/**
 * One rail entry per mechanism, each opening a flyout of its destinations.
 *
 * Fifteen icons in a 64px column carried no structure and, at a laptop's height, left no room
 * to label anything — the rail could only ever be icons plus a tooltip. Grouping them under a
 * single entry per area fixes both at once: the rail becomes seven rows, which fits any screen
 * comfortably, and the flyout is wide enough to show a real label beside each icon.
 */
const GROUP_META: Record<
  Exclude<NavGroup, 'overview'>,
  { icon: typeof LayoutDashboard; labelKey: string }
> = {
  content: { icon: LayoutTemplate, labelKey: 'nav.groupContent' },
  people: { icon: Users, labelKey: 'nav.groupPeople' },
  commerce: { icon: DollarSign, labelKey: 'nav.groupCommerce' },
  platform: { icon: Cog, labelKey: 'nav.groupPlatform' },
};
interface TabDef {
  href: string;
  title: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  group: NavGroup;
  match: (pathname: string) => boolean;
}
const tabsBase: Omit<TabDef, 'title'>[] = [
  {
    href: '/admin',
    group: 'overview',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p === '/admin',
  },
  {
    href: '/admin/builder',
    group: 'content',
    icon: LayoutTemplate,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/builder'),
  },
  {
    href: '/admin/email',
    group: 'platform',
    icon: Mail,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/email'),
  },
  {
    href: '/admin/navigation',
    group: 'platform',
    icon: Navigation,
    roles: ['super_admin', 'admin'],
    match: (p) => p.startsWith('/admin/navigation'),
  },
  {
    href: '/admin/theme',
    group: 'platform',
    icon: Palette,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/theme'),
  },
  {
    href: '/admin/analytics',
    group: 'platform',
    icon: BarChart2,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/analytics'),
  },
  {
    href: '/admin/users',
    group: 'people',
    icon: Users,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/users'),
  },
  {
    href: '/admin/staff',
    group: 'people',
    icon: UserCog,
    roles: ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'],
    match: (p) => p.startsWith('/admin/staff'),
  },
  {
    href: '/admin/academies',
    group: 'content',
    icon: GraduationCap,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/academies'),
  },
  {
    href: '/admin/courses',
    group: 'content',
    icon: BookOpen,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/courses'),
  },
  {
    href: '/admin/products',
    group: 'content',
    icon: Package,
    roles: ['super_admin', 'admin'],
    match: (p) => p.startsWith('/admin/products'),
  },
  {
    href: '/admin/finance',
    group: 'commerce',
    icon: DollarSign,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/finance'),
  },
  {
    href: '/admin/certificates',
    group: 'commerce',
    icon: Award,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/certificates'),
  },
  {
    // Platform-critical alerting is a super-admin responsibility; the API
    // refuses everyone else, so the entry is hidden from them too.
    href: '/admin/alerts',
    group: 'platform',
    icon: TriangleAlert,
    roles: ['super_admin'],
    match: (p) => p.startsWith('/admin/alerts'),
  },
  {
    href: '/admin/settings',
    group: 'platform',
    icon: Settings,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/settings'),
  },
  {
    href: '/',
    group: 'platform',
    icon: ExternalLink,
    roles: ['super_admin', 'admin', 'instructor'],
    match: () => false,
  },
] as const;
/**
 * Leaf keys under the `admin` namespace, one per rail tab.
 *
 * These must address a *string*. `admin.navigation` and `admin.email` are both
 * objects — they hold nested copy for the editors — so they are reached as
 * `navigation.title` / `email.title`. Passing the bare segment makes next-intl
 * throw INSUFFICIENT_PATH at render time rather than falling back to a missing
 * key, which is how `/admin/email` used to log MISSING_MESSAGE on every render.
 */
const tabKeyMap: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/builder': 'builder',
  '/admin/navigation': 'navigation.title',
  '/admin/email': 'email.title',
  '/admin/theme': 'theme',
  '/admin/analytics': 'analytics',
  '/admin/staff': 'staff',
  '/admin/users': 'users',
  '/admin/academies': 'academies',
  '/admin/courses': 'courses',
  '/admin/products': 'products',
  '/admin/finance': 'finance',
  '/admin/certificates': 'certificates',
  '/admin/alerts': 'alerts',
  '/admin/settings': 'settings',
  '/': 'viewSite',
};
function RailButton({
  href,
  title,
  active,
  children,
}: {
  href: string;
  title: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        'group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
        active
          ? 'bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {' '}
      {children}{' '}
      <span className="pointer-events-none absolute start-full z-50 ms-3 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
        {' '}
        {title}{' '}
      </span>{' '}
    </Link>
  );
}
function SearchRailButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={openAdminSearch}
      title={label}
      className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
    >
      {' '}
      <Search className="size-[18px]" />{' '}
      <span className="pointer-events-none absolute start-full z-50 ms-3 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
        {' '}
        {label}{' '}
      </span>{' '}
    </button>
  );
}
export function AdminRail() {
  const tAdmin = useTranslations('admin');
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const tabs: TabDef[] = tabsBase.map((b) => ({
    ...b,
    title: tAdmin(tabKeyMap[b.href] ?? b.href),
  }));
  // Stable sort: entries keep their `tabsBase` order inside a group, so the sequence within
  // Content or Commerce is still the deliberate one in the source.
  const visibleTabs = tabs
    .filter((t) => t.roles.includes(role))
    .sort(
      (a, b) =>
        NAV_GROUP_ORDER.indexOf(a.group) - NAV_GROUP_ORDER.indexOf(b.group),
    );
  // The admin console's bell points at the platform feed for a super admin and
  // stays a personal dropdown for everyone else, since `/admin/alerts` is
  // super-admin only.
  const isSuperAdmin = role === 'super_admin';
  const [openGroup, setOpenGroup] = useState<NavGroup | null>(null);
  const [mobileGroup, setMobileGroup] = useState<NavGroup | null>(null);

  // One rail entry per mechanism, each carrying the destinations it owns. Only groups that
  // still have a destination this role can open are shown, so an instructor never gets a dead
  // button that opens to nothing.
  const navGroups = useMemo(
    () =>
      NAV_GROUP_ORDER.filter((key) => key !== 'overview').map((key) => ({
        key,
        children: visibleTabs.filter((tab) => tab.group === key),
      })),
    [visibleTabs],
  );

  // Navigating should close the flyout: leaving it open over the next screen reads as a stale
  // menu rather than one that belongs to where you now are.
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenGroup(null);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-nav-root]')) return;
      setOpenGroup(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [openGroup]);

  return (
    <>
      {' '}
      <aside className="no-scrollbar fixed inset-y-0 start-0 z-40 hidden w-16 flex-col items-center gap-1.5 border-r border-border bg-card/60 py-3 lg:flex">
        {' '}
        <Link
          href="/admin"
          title="TITANS Admin"
          className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs"
        >
          <Crosshair className="size-4" strokeWidth={2.5} />
        </Link>{' '}
        <div className="mb-1 flex shrink-0 flex-col items-center gap-1">
          {' '}
          <SearchRailButton label={tAdmin('searchHint')} />{' '}
          {isSuperAdmin ? <PlatformAlertsRailBell /> : <NotificationBell />}{' '}
        </div>{' '}
        {/*
          Rendered from `visibleTabs`, the same list the mobile bar below uses.

          This used to be thirteen hand-written <RailButton>s with the role checks copied
          alongside them, which meant a route added to `tabsBase` appeared on phones and
          nowhere else — /admin/email, /admin/navigation and the rest were reachable only
          by scrolling the mobile bar. Two renderings of one list cannot both stay right;
          this one is derived, so a new entry cannot be left out of a viewport by accident.
        */}
        {visibleTabs
          .filter((tab) => tab.group === 'overview')
          .map((tab) => (
            <RailButton
              key={tab.href}
              href={tab.href}
              title={tab.title}
              active={Boolean(tab.match(pathname))}
            >
              {' '}
              <tab.icon className="size-[18px]" />{' '}
            </RailButton>
          ))}{' '}
        {navGroups.map((group) => {
          const meta = GROUP_META[group.key];
          // A group lights up when the route you are on belongs to it, so you always know which
          // area the current screen lives in without opening anything.
          const containsActive = group.children.some((child) => child.match(pathname));
          const open = openGroup === group.key;
          return (
            <div key={group.key} data-nav-root className="relative">
              <button
                type="button"
                onClick={() => setOpenGroup((current) => (current === group.key ? null : group.key))}
                aria-expanded={open}
                aria-haspopup="menu"
                title={tAdmin(meta.labelKey)}
                className={cn(
                  'group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
                  containsActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <meta.icon className="size-[18px]" />
                {group.children.length > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -bottom-0.5 -end-0.5 size-1.5 rounded-full bg-primary transition-opacity',
                      containsActive || open ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                )}
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute start-full top-0 z-50 ms-2 w-60 animate-in overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                >
                  <p className="px-2.5 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {tAdmin(meta.labelKey)}
                  </p>
                  {group.children.map((child) => {
                    const active = Boolean(child.match(pathname));
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        role="menuitem"
                        onClick={() => setOpenGroup(null)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          active
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <child.icon className="size-4 shrink-0 opacity-80" />
                        <span className="truncate">{child.title}</span>
                        {active && <span className="ms-auto size-1.5 rounded-full bg-primary" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}{' '}
        {visibleTabs
          .filter((tab) => tab.href === '/')
          .map((tab) => (
            <RailButton key={tab.href} href={tab.href} title={tab.title} active={false}>
              {' '}
              <tab.icon className="size-[18px]" />{' '}
            </RailButton>
          ))}{' '}
        <div className="sticky bottom-0 mt-auto flex shrink-0 flex-col items-center gap-1 bg-card/95 pt-2 backdrop-blur-sm">
          {' '}
          <div className="my-1 h-px w-8 bg-border" />{' '}
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            title={tAdmin('exitAdmin')}
            className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:border-red-900/30"
          >
            {' '}
            <LogOut className="size-[18px]" />{' '}
            <span className="pointer-events-none absolute start-full z-50 ms-3 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
              {' '}
              {tAdmin('exitAdmin')}{' '}
            </span>{' '}
          </button>{' '}
        </div>{' '}
      </aside>{' '}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {' '}
        <div className="grid grid-cols-6 gap-1 px-2 py-1">
          {' '}
          {NAV_GROUP_ORDER.filter((key) => key !== 'overview').map((key) => {
            const group = navGroups.find((g) => g.key === key);
            if (!group || !group.children.length) return null;
            const active = group.children.some((tab) => tab.match(pathname));
            const Icon = group.children[0]!.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMobileGroup(key)}
                className={`flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs font-semibold transition ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {' '}
                <Icon className="size-[18px] shrink-0" />{' '}
                <span className="max-w-full truncate leading-tight">
                    {key === 'content'
                      ? tAdmin('nav.groupContent')
                      : key === 'people'
                        ? tAdmin('nav.groupPeople')
                        : key === 'commerce'
                          ? tAdmin('nav.groupCommerce')
                          : tAdmin('nav.groupPlatform')}
                  </span>{' '}
              </button>
            );
          })}{' '}
          <button
            type="button"
            onClick={openAdminSearch}
            title={tAdmin('searchHint')}
            className="flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs font-semibold text-muted-foreground transition"
          >
            {' '}
            <Search className="size-[18px] shrink-0" />{' '}
            <span className="max-w-full truncate leading-tight">{tAdmin('search')}</span>{' '}
          </button>{' '}
          <div className="flex min-w-[2.5rem] items-center justify-center">
            {' '}
            {isSuperAdmin ? <PlatformAlertsRailBell /> : <NotificationBell />}
          </div>{' '}
        </div>{' '}
      </nav>{' '}
      {mobileGroup ? (
        <>
          {' '}
          <button
            type="button"
            aria-label="Close navigation group"
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileGroup(null)}
          />
          {' '}
          <div className="fixed inset-x-0 bottom-0 z-[65] max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl lg:hidden">
            {' '}
            <div className="mb-3 flex items-center justify-between">
              {' '}
              <h2 className="text-base font-bold text-foreground">
                {mobileGroup === 'content'
                  ? tAdmin('nav.groupContent')
                  : mobileGroup === 'people'
                    ? tAdmin('nav.groupPeople')
                    : mobileGroup === 'commerce'
                      ? tAdmin('nav.groupCommerce')
                      : tAdmin('nav.groupPlatform')}
              </h2>{' '}
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setMobileGroup(null)}
              >
                Close
              </button>{' '}
            </div>{' '}
            <div className="grid grid-cols-2 gap-2">
              {' '}
              {(navGroups.find((g) => g.key === mobileGroup)?.children ?? []).map((tab) => {
                const active = tab.match(pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMobileGroup(null)}
                    className={`flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-medium transition ${active ? 'border-primary bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                  >
                    {' '}
                    <tab.icon className="size-4 shrink-0" />{' '}
                    <span>{tab.title}</span>{' '}
                  </Link>
                );
              })}
            </div>{' '}
          </div>
        </>
      ) : null}
    </>
  );
}
