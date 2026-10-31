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
  ClipboardList,
  TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
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
    // Quote requests are sales leads, not storefront content. The inbox existed
    // at /admin/quotes but was unreachable from the rail, so a notification could
    // link to a page the admin had no way to find again.
    href: '/admin/quotes',
    group: 'commerce',
    icon: ClipboardList,
    roles: ADMIN_ROLES,
    match: (p) => p.startsWith('/admin/quotes'),
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
  '/admin/quotes': 'quotes.title',
  '/admin/certificates': 'certificates',
  '/admin/alerts': 'alerts',
  '/admin/settings': 'settings',
  '/': 'viewSite',
};
/** Shared hover label for rail entries — an ink chip that slides out from the rail. */
const RAIL_TIP =
  'pointer-events-none absolute start-full z-50 ms-3 -translate-x-1 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 rtl:translate-x-1 rtl:group-hover:translate-x-0';

const RAIL_ITEM =
  'group relative flex shrink-0 items-center justify-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring';

/** The one sliding "you are here" marker shared by every rail entry. */
function RailActiveMarker() {
  return (
    <m.span
      layoutId="admin-rail-active"
      aria-hidden="true"
      className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/15"
      transition={spring.smooth}
    >
      <span className="absolute -start-[13px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-e-full bg-primary" />
    </m.span>
  );
}

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
        RAIL_ITEM,
        'size-9',
        active ? 'text-primary' : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
      )}
    >
      {active && <RailActiveMarker />}
      <span className="relative flex">{children}</span>
      <span className={RAIL_TIP}>{title}</span>
    </Link>
  );
}
function SearchRailButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={openAdminSearch}
      title={label}
      className={cn(
        RAIL_ITEM,
        'size-9 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
      )}
    >
      <Search className="size-[18px]" />
      <span className={RAIL_TIP}>{label}</span>
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

  // The mobile sheet is a modal surface: Escape dismisses it, like every other sheet.
  useEffect(() => {
    if (!mobileGroup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileGroup(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileGroup]);

  const groupLabel = (key: NavGroup) =>
    key === 'content'
      ? tAdmin('nav.groupContent')
      : key === 'people'
        ? tAdmin('nav.groupPeople')
        : key === 'commerce'
          ? tAdmin('nav.groupCommerce')
          : tAdmin('nav.groupPlatform');

  return (
    <>
      <aside className="no-scrollbar fixed inset-y-0 start-0 z-40 hidden w-16 flex-col items-center gap-1 border-e border-border/70 bg-surface-sunken/70 py-3 backdrop-blur-sm lg:flex">
        <Link
          href="/admin"
          title="TITANS Admin"
          className="mb-2 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 hover:-rotate-6 active:scale-95"
        >
          <Crosshair className="size-4" strokeWidth={2.5} />
        </Link>
        <div className="mb-1 flex shrink-0 flex-col items-center gap-1">
          <SearchRailButton label={tAdmin('searchHint')} />
          {isSuperAdmin ? <PlatformAlertsRailBell /> : <NotificationBell />}
        </div>
        <div className="my-1.5 h-px w-6 shrink-0 bg-border/80" aria-hidden="true" />
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
              <tab.icon className="size-[18px]" />
            </RailButton>
          ))}
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
                  RAIL_ITEM,
                  'size-9',
                  containsActive
                    ? 'text-primary'
                    : open
                      ? 'bg-foreground/[0.06] text-foreground'
                      : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
                )}
              >
                {containsActive && <RailActiveMarker />}
                <meta.icon className="relative size-[18px]" />
              </button>
              <AnimatePresence>
                {open && (
                  <m.div
                    role="menu"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1, transition: spring.smooth }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: ease.exit } }}
                    className="absolute start-full top-0 z-50 ms-3 w-60 origin-top-left overflow-hidden rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg rtl:origin-top-right"
                  >
                    <p className="px-2.5 pb-1.5 pt-1.5 text-xs font-medium text-muted-foreground">
                      {tAdmin(meta.labelKey)}
                    </p>
                    {group.children.map((child, index) => {
                      const active = Boolean(child.match(pathname));
                      return (
                        <m.div
                          key={child.href}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.22, ease: ease.emerge, delay: 0.02 + index * 0.025 },
                          }}
                        >
                          <Link
                            href={child.href}
                            role="menuitem"
                            onClick={() => setOpenGroup(null)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:bg-muted',
                              active
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-foreground hover:bg-muted',
                            )}
                          >
                            <child.icon
                              className={cn(
                                'size-4 shrink-0',
                                active ? 'text-primary' : 'text-muted-foreground',
                              )}
                            />
                            <span className="truncate">{child.title}</span>
                            {active && <span className="ms-auto size-1.5 rounded-full bg-primary" />}
                          </Link>
                        </m.div>
                      );
                    })}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {visibleTabs
          .filter((tab) => tab.href === '/')
          .map((tab) => (
            <RailButton key={tab.href} href={tab.href} title={tab.title} active={false}>
              <tab.icon className="size-[18px]" />
            </RailButton>
          ))}
        <div className="sticky bottom-0 mt-auto flex shrink-0 flex-col items-center gap-1 pt-2">
          <div className="my-1 h-px w-6 bg-border/80" />
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            title={tAdmin('exitAdmin')}
            className={cn(
              RAIL_ITEM,
              'size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <LogOut className="flip-rtl size-[18px]" />
            <span className={RAIL_TIP}>{tAdmin('exitAdmin')}</span>
          </button>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-6 gap-1 px-2 py-1">
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
                className={cn(
                  'relative flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs font-medium transition-colors active:scale-95',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {active && (
                  <m.span
                    layoutId="admin-mobile-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={spring.smooth}
                  />
                )}
                <Icon className="relative size-[18px] shrink-0" />
                <span className="relative max-w-full truncate leading-tight">{groupLabel(key)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={openAdminSearch}
            title={tAdmin('searchHint')}
            className="flex min-w-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-2xs font-medium text-muted-foreground transition active:scale-95"
          >
            <Search className="size-[18px] shrink-0" />
            <span className="max-w-full truncate leading-tight">{tAdmin('search')}</span>
          </button>
          <div className="flex min-w-[2.5rem] items-center justify-center">
            {isSuperAdmin ? <PlatformAlertsRailBell /> : <NotificationBell />}
          </div>
        </div>
      </nav>
      <AnimatePresence>
        {mobileGroup ? (
          <>
            <m.button
              key="admin-mobile-scrim"
              type="button"
              aria-label="Close navigation group"
              className="fixed inset-0 z-[60] bg-overlay/45 backdrop-blur-[3px] lg:hidden"
              onClick={() => setMobileGroup(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.22, ease: ease.emerge } }}
              exit={{ opacity: 0, transition: { duration: 0.16, ease: ease.exit } }}
            />
            <m.div
              key="admin-mobile-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={groupLabel(mobileGroup)}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: spring.gentle }}
              exit={{ y: '100%', transition: { duration: 0.2, ease: ease.exit } }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) setMobileGroup(null);
              }}
              className="fixed inset-x-0 bottom-0 z-[65] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border/70 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl lg:hidden"
            >
              <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong/70" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
                  {groupLabel(mobileGroup)}
                </h2>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileGroup(null)}
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(navGroups.find((g) => g.key === mobileGroup)?.children ?? []).map((tab, index) => {
                  const active = tab.match(pathname);
                  return (
                    <m.div
                      key={tab.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.28, ease: ease.emerge, delay: 0.06 + index * 0.035 },
                      }}
                    >
                      <Link
                        href={tab.href}
                        onClick={() => setMobileGroup(null)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors active:scale-[0.98]',
                          active
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border/70 text-foreground hover:bg-muted',
                        )}
                      >
                        <tab.icon
                          className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                        />
                        <span>{tab.title}</span>
                      </Link>
                    </m.div>
                  );
                })}
              </div>
            </m.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
