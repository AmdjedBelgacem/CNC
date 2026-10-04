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
 * These must address a *string*. `admin.navigation` is an object, so it is
 * reached as `navigation.title` — passing the bare segment makes next-intl throw
 * INSUFFICIENT_PATH at render time rather than falling back to a missing key.
 */
const tabKeyMap: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/builder': 'builder',
  '/admin/navigation': 'navigation.title',
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
        'group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150',
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
      className="group relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
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
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-16 flex-col items-center gap-1.5 border-r border-border bg-card/60 py-5 lg:flex">
        {' '}
        <Link
          href="/admin"
          title="TITANS Admin"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs"
        >
          <Crosshair className="size-4" strokeWidth={2.5} />
        </Link>{' '}
        <div className="mb-1.5 flex flex-col items-center gap-1.5">
          {' '}
          <SearchRailButton label={tAdmin('searchHint')} />{' '}
          {isSuperAdmin ? <PlatformAlertsRailBell /> : <NotificationBell />}{' '}
        </div>{' '}
        <RailButton href="/admin" title={tAdmin('dashboard')} active={pathname === '/admin'}>
          {' '}
          <LayoutDashboard className="size-[18px]" />{' '}
        </RailButton>{' '}
        <RailButton
          href="/admin/builder"
          title={tAdmin('builder')}
          active={pathname.startsWith('/admin/builder')}
        >
          {' '}
          <LayoutTemplate className="size-[18px]" />{' '}
        </RailButton>{' '}
        {role === 'super_admin' || role === 'admin' ? (
          <>
            {' '}
            <RailButton
              href="/admin/theme"
              title={tAdmin('theme')}
              active={pathname.startsWith('/admin/theme')}
            >
              {' '}
              <Palette className="size-[18px]" />{' '}
            </RailButton>{' '}
            <RailButton
              href="/admin/analytics"
              title={tAdmin('analytics')}
              active={pathname.startsWith('/admin/analytics')}
            >
              {' '}
              <BarChart2 className="size-[18px]" />{' '}
            </RailButton>{' '}
            <RailButton
              href="/admin/users"
              title={tAdmin('users')}
              active={pathname.startsWith('/admin/users')}
            >
              {' '}
              <Users className="size-[18px]" />{' '}
            </RailButton>{' '}
          </>
        ) : null}{' '}
        {['super_admin', 'admin', 'instructor', 'moderator', 'sponsor'].includes(role) ? (
          <RailButton
            href="/admin/staff"
            title={tAdmin('staff')}
            active={pathname.startsWith('/admin/staff')}
          >
            {' '}
            <UserCog className="size-[18px]" />{' '}
          </RailButton>
        ) : null}{' '}
        <RailButton
          href="/admin/academies"
          title={tAdmin('academies')}
          active={pathname.startsWith('/admin/academies')}
        >
          {' '}
          <GraduationCap className="size-[18px]" />{' '}
        </RailButton>{' '}
        <RailButton
          href="/admin/courses"
          title={tAdmin('courses')}
          active={pathname.startsWith('/admin/courses')}
        >
          {' '}
          <BookOpen className="size-[18px]" />{' '}
        </RailButton>{' '}
        <RailButton
          href="/admin/products"
          title={tAdmin('products')}
          active={pathname.startsWith('/admin/products')}
        >
          {' '}
          <Package className="size-[18px]" />{' '}
        </RailButton>{' '}
        {role === 'super_admin' || role === 'admin' ? (
          <>
            {' '}
            <RailButton
              href="/admin/finance"
              title={tAdmin('finance')}
              active={pathname.startsWith('/admin/finance')}
            >
              {' '}
              <DollarSign className="size-[18px]" />{' '}
            </RailButton>{' '}
            <RailButton
              href="/admin/certificates"
              title={tAdmin('certificates')}
              active={pathname.startsWith('/admin/certificates')}
            >
              {' '}
              <Award className="size-[18px]" />{' '}
            </RailButton>{' '}
            <RailButton
              href="/admin/settings"
              title={tAdmin('settings')}
              active={pathname.startsWith('/admin/settings')}
            >
              {' '}
              <Settings className="size-[18px]" />{' '}
            </RailButton>{' '}
          </>
        ) : null}{' '}
        <div className="mt-auto flex flex-col items-center gap-1.5">
          {' '}
          <div className="my-1.5 h-px w-8 bg-border" />{' '}
          <RailButton href="/" title={tAdmin('viewSite')} active={false}>
            {' '}
            <ExternalLink className="size-[18px]" />{' '}
          </RailButton>{' '}
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            title={tAdmin('exitAdmin')}
            className="group relative flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:border-red-900/30"
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
