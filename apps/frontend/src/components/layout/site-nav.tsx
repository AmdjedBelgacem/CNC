'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { NavItemView } from '@titan/shared';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';

/**
 * The admin-managed navigation, rendered.
 *
 * Two implementations over one tree: a hover/focus dropdown for pointer and
 * keyboard users on desktop, and a disclosure accordion on mobile. They are
 * separate because the interactions genuinely differ — a hover menu that also
 * had to work on a touch screen is a menu that closes when you try to scroll it.
 */

/**
 * Deliberately NOT named `useIsActive`: it holds no hooks and is called inside
 * `.some()` callbacks. If it were ever given a hook, those calls would break
 * the rules of hooks at exactly the moment someone least expects it.
 */
/**
 * Whether a nav item points at the location currently being viewed.
 *
 * A menu entry may carry a query string — the Machines department is
 * `/products?category=Machines` — and `pathname` never contains one, so
 * comparing the raw href could never match and the item never highlighted.
 * The path decides *where*, and the query decides *which view*: an entry with a
 * query only matches that exact query, and an entry without one only matches a
 * bare path. That keeps `/products` and `/products?category=Machines` from
 * highlighting two items at once.
 */
function isActiveRoute(href: string, pathname: string, search = ''): boolean {
  if (!href) return false;
  // An external link can never be the current route.
  if (/^https?:\/\//.test(href)) return false;
  const [path, query = ''] = href.split('?');
  if (!(pathname === path || pathname.startsWith(`${path}/`))) return false;
  return query === search.replace(/^\?/, '');
}

/* ------------------------------------------------------------- desktop */

function DesktopDropdown({
  item,
  pathname,
  search,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A dropdown left open after the route changes keeps the old menu on screen.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // Delayed close so the pointer can cross the gap between trigger and panel.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => cancelClose, []);

  const hasActiveChild = item.children.some((child) => isActiveRoute(child.href, pathname, search));

  return (
    <div
      ref={ref}
      className="relative flex items-stretch self-stretch"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        // Colour tracks `open || hasActiveChild` because the whole trigger is
        // highlighted on hover; the *indicator* deliberately does not (see the
        // note below) so it can't collide with an active sibling's.
        className={cn(
          'relative flex items-center gap-1 px-3.5 text-[13px] font-medium tracking-[0.01em] transition-colors',
          open || hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {item.label}
        {/* Same spring as the mobile disclosure, so a group trigger's chevron
            and its indicator agree about how "open" looks. */}
        <m.span
          className="flex"
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          aria-hidden
        >
          <ChevronDown className="size-3.5" />
        </m.span>

        {/* Shares `primary-nav-indicator` with DesktopLink, so the underline
            slides between a plain item and a group trigger as well as between
            two plain items.

            Gated on `hasActiveChild`, NOT on `open`: hover is transient and can
            be true for a group that isn't the current route, which would mount
            a second element with the same `layoutId` at the same time as an
            active DesktopLink's. Duplicate layoutIds break the shared-element
            morph (Framer Motion warns and both snap). A route is either inside
            the group or on a sibling link, so route-based gating can't collide. */}
        {hasActiveChild && (
          <m.span
            layoutId="primary-nav-indicator"
            aria-hidden
            className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary"
            transition={spring.smooth}
          />
        )}
      </button>

      {/* Hover-intent open means this appears on mouseenter, so it is on screen
          for only a few hundred milliseconds at a time. Animating in and out
          every time would be noise, so it uses the quick popover timing rather
          than a full reveal. */}
      <AnimatePresence>
        {open && (
          <m.div
            key="panel"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: spring.snappy }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
            className="absolute start-0 top-full z-50 min-w-56 pt-1"
          >
            <div className="overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg">
              <Stagger gap={0.025} maxDelay={0.16}>
                {item.children.map((child, i) => (
                  <StaggerItem key={child.id} index={i}>
                    <DesktopChild child={child} pathname={pathname} search={search} />
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DesktopChild({
  child,
  pathname,
  search,
}: {
  child: NavItemView;
  pathname: string;
  search: string;
}) {
  const active = isActiveRoute(child.href, pathname, search);
  const external = child.openInNewTab || /^https?:\/\//.test(child.href);
  const className = cn(
    'flex items-center justify-between gap-4 rounded-sm px-3 py-2 text-[13px] transition-colors',
    active
      ? 'bg-primary/10 font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  // A child with its own children would need a third level, which the service
  // flattens away. Rendering it as a plain link is the honest fallback.
  if (child.children.length) {
    return (
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
        {child.label}
      </div>
    );
  }

  return external ? (
    <a href={child.href} target="_blank" rel="noopener noreferrer" className={className}>
      {child.label}
      <span aria-hidden className="font-mono text-[10px] opacity-60">
        ↗
      </span>
    </a>
  ) : (
    <Link href={child.href} aria-current={active ? 'page' : undefined} className={className}>
      {child.label}
    </Link>
  );
}

/* ------------------------------------------------------------- mobile */

function MobileGroup({
  item,
  pathname,
  search,
  defaultOpen,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasActiveChild = item.children.some((child) => isActiveRoute(child.href, pathname, search));

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between rounded-md border-s-2 px-3 py-2.5 text-sm font-medium transition-colors',
          hasActiveChild
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {item.label}
        {/* The chevron rides the same spring as the panel below it. Driving both
            with one transition is what makes the disclosure feel like a single
            object opening; a CSS `duration-200` on the rotation next to a
            spring on the height reads as two unrelated animations. */}
        <m.span
          className="flex"
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          aria-hidden
        >
          <ChevronDown className="size-4" />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: spring.gentle }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 border-s-2 border-border/60 ps-3 pe-3 pt-1">
              <Stagger gap={0.03} maxDelay={0.2}>
                {item.children.map((child, i) => {
                  const active = isActiveRoute(child.href, pathname, search);
                  return (
                    <StaggerItem as="div" key={child.id} index={i}>
                      <Link
                        href={child.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'rounded-md px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-primary/10 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {child.label}
                      </Link>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------- exports */

export function SiteNavDesktop({ items }: { items: NavItemView[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  if (!items.length) return null;
  return (
    <nav className="hidden items-stretch self-stretch md:flex" aria-label="Primary">
      {items.map((item) =>
        item.type === 'group' ? (
          <DesktopDropdown key={item.id} item={item} pathname={pathname} search={search} />
        ) : (
          <DesktopLink key={item.id} item={item} pathname={pathname} search={search} />
        ),
      )}
    </nav>
  );
}

function DesktopLink({
  item,
  pathname,
  search,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
}) {
  const active = isActiveRoute(item.href, pathname, search);
  if (item.openInNewTab || /^https?:\/\//.test(item.href)) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center px-3.5 text-[13px] font-medium tracking-[0.01em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center px-3.5 text-[13px] font-medium tracking-[0.01em] transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {item.label}

      {/* One shared indicator that MORPHS between items rather than a per-item
          underline that fades in and out.

          Every active item renders the same `layoutId`, so Framer Motion
          measures the outgoing bar and the incoming one and tweens between
          them: moving from "Courses" to "Academy" slides the underline across
          instead of blinking one out and the other in. That continuity is what
          makes the nav feel like a physical object rather than a set of
          re-rendered links.

          `layoutId` has to be unique among *simultaneously mounted* elements —
          only one item is ever active, so that holds. (The mobile nav has no
          indicator, so it can't collide.) */}
      {active && (
        <m.span
          layoutId="primary-nav-indicator"
          aria-hidden
          className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary"
          transition={spring.smooth}
        />
      )}
    </Link>
  );
}

export function SiteNavMobile({
  items,
  onNavigate,
}: {
  items: NavItemView[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  if (!items.length) return null;
  return (
    <>
      {items.map((item) =>
        item.type === 'group' ? (
          <MobileGroup
            key={item.id}
            item={item}
            pathname={pathname}
            search={search}
            defaultOpen={item.children.some((child) => isActiveRoute(child.href, pathname, search))}
          />
        ) : (
          <MobileLink
            key={item.id}
            item={item}
            pathname={pathname}
            search={search}
            onNavigate={onNavigate}
          />
        ),
      )}
    </>
  );
}

function MobileLink({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
  onNavigate?: () => void;
}) {
  const active = isActiveRoute(item.href, pathname, search);
  const className = cn(
    'flex items-center justify-between rounded-md border-s-2 px-3 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'border-primary bg-primary/5 text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  );
  if (item.openInNewTab || /^https?:\/\//.test(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {item.label}
        <span aria-hidden className="font-mono text-[10px] opacity-60">
          ↗
        </span>
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {item.label}
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
        {item.href}
      </span>
    </Link>
  );
}
