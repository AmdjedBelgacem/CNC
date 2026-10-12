'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ExternalLink,
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
interface TabDef {
  href: string;
  title: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  match: (pathname: string) => boolean;
}
const tabsBase: Omit<TabDef, 'title'>[] = [
  {
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p === '/admin',
  },
  {
    href: '/admin/builder',
    icon: LayoutTemplate,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/builder'),
  },
  {
    href: '/admin/email',
    icon: Mail,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/email'),
  },
  {
    href: '/admin/navigation',
    icon: Navigation,
    roles: ['super_admin', 'admin'],
    match: (p) => p.startsWith('/admin/navigation'),
  },
  {
    href: '/admin/theme',
    icon: Palette,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/theme'),
  },
  {
    href: '/admin/analytics',
    icon: BarChart2,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/analytics'),
  },
  {
    href: '/admin/staff',
    icon: UserCog,
    roles: ['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'],
    match: (p) => p.startsWith('/admin/staff'),
  },
  {
    href: '/admin/users',
    icon: Users,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/users'),
  },
  {
    href: '/admin/academies',
    icon: GraduationCap,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/academies'),
  },
  {
    href: '/admin/courses',
    icon: BookOpen,
    roles: ['super_admin', 'admin', 'instructor'],
    match: (p) => p.startsWith('/admin/courses'),
  },
  {
    href: '/admin/products',
    icon: Package,
    roles: ['super_admin', 'admin'],
    match: (p) => p.startsWith('/admin/products'),
  },
  {
    href: '/admin/finance',
    icon: DollarSign,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/finance'),
  },
  {
    href: '/admin/certificates',
    icon: Award,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/certificates'),
  },
  {
    // Platform-critical alerting is a super-admin responsibility; the API
    // refuses everyone else, so the entry is hidden from them too.
    href: '/admin/alerts',
    icon: TriangleAlert,
    roles: ['super_admin'],
    match: (p) => p.startsWith('/admin/alerts'),
  },
  {
    href: '/admin/settings',
    icon: Settings,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/settings'),
  },
  {
    href: '/',
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
  const visibleTabs = tabs.filter((t) => t.roles.includes(role));
  // The admin console's bell points at the platform feed for a super admin and
  // stays a personal dropdown for everyone else, since `/admin/alerts` is
  // super-admin only.
  const isSuperAdmin = role === 'super_admin';
  return (
    <>
      {' '}
      <aside className="no-scrollbar fixed inset-y-0 start-0 z-40 hidden w-16 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-card/60 py-3 lg:flex">
        {' '}
        <Link
          href="/admin"
          title="TITANS Admin"
          className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs"
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
        {visibleTabs.map((tab) => (
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
        <div className="no-scrollbar flex h-14 items-stretch gap-0.5 overflow-x-auto px-2">
          {' '}
          {visibleTabs.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.title}
                className={`flex min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-2xs font-semibold transition ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {' '}
                <tab.icon className="size-[18px] shrink-0" />{' '}
                <span className="max-w-full truncate leading-tight">{tab.title}</span>{' '}
              </Link>
            );
          })}{' '}
          <button
            type="button"
            onClick={openAdminSearch}
            title={tAdmin('searchHint')}
            className="flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-2xs font-semibold text-muted-foreground transition"
          >
            {' '}
            <Search className="size-[18px] shrink-0" />{' '}
            <span className="max-w-full truncate leading-tight">{tAdmin('search')}</span>{' '}
          </button>{' '}
          {isSuperAdmin ? (
            <PlatformAlertsRailBell className="h-14 min-w-[3.5rem] rounded-lg" />
          ) : (
            <NotificationBell className="h-14 min-w-[3.5rem] rounded-lg" />
          )}{' '}
        </div>{' '}
      </nav>{' '}
    </>
  );
}
