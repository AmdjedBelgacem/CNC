'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItemView } from '@titan/shared';
import { cn } from '@/lib/utils';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
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

/**
 * Two shared-element indicators ride across the desktop nav:
 *
 *  - `primary-nav-hover` — a soft ivory pill that follows the pointer from item
 *    to item. Only one item is ever hovered, so the layoutId stays unique.
 *  - `primary-nav-indicator` — a short clay rule under the current route.
 *    Route-gated (never hover-gated), so it can't collide with itself.
 *
 * Both are wrapped in one `LayoutGroup` so they measure against the same nav.
 */
const NAV_ITEM_CLASS =
  'relative z-0 flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function HoverPill() {
  return (
    <m.span
      layoutId="primary-nav-hover"
      aria-hidden
      className="absolute inset-0 -z-10 rounded-full bg-muted/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={spring.smooth}
    />
  );
}

function ActiveRule() {
  return (
    <m.span
      layoutId="primary-nav-indicator"
      aria-hidden
      className="absolute inset-x-0 -bottom-[13px] mx-auto h-[2px] w-5 rounded-full bg-primary"
      transition={spring.smooth}
    />
  );
}

function DesktopDropdown({
  item,
  pathname,
  search,
  hovered,
  onHover,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
  hovered: boolean;
  onHover: (id: string | null) => void;
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
      className="relative flex items-center"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
        onHover(item.id);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => {
          setOpen(true);
          onHover(item.id);
        }}
        className={cn(
          NAV_ITEM_CLASS,
          open || hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <AnimatePresence>{hovered && <HoverPill />}</AnimatePresence>
        {item.label}
        {/* Same spring as the mobile disclosure, so a group trigger's chevron
            and its panel agree about how "open" looks. */}
        <m.span
          className="flex opacity-60"
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.snappy}
          aria-hidden
        >
          <ChevronDown className="size-3.5" />
        </m.span>
        {hasActiveChild && <ActiveRule />}
      </button>

      {/* Hover-intent open means this appears on mouseenter, so it uses the
          quick popover timing rather than a full reveal. Scales from the
          trigger so it reads as unfolding out of it. */}
      <AnimatePresence>
        {open && (
          <m.div
            key="panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.smooth }}
            exit={{
              opacity: 0,
              y: -4,
              scale: 0.98,
              transition: { duration: 0.12, ease: [0.4, 0, 1, 1] },
            }}
            style={{ transformOrigin: 'top left' }}
            className="absolute start-0 top-full z-50 min-w-60 pt-3"
          >
            <div className="overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg ring-1 ring-black/[0.02] dark:ring-white/[0.03]">
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
    'group/child flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-primary/[0.07] font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  // A child with its own children would need a third level, which the service
  // flattens away. Rendering it as a plain label is the honest fallback.
  if (child.children.length) {
    return (
      <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground/80">
        {child.label}
      </div>
    );
  }

  return external ? (
    <a href={child.href} target="_blank" rel="noopener noreferrer" className={className}>
      {child.label}
      <ArrowUpRight
        aria-hidden
        className="size-3.5 opacity-50 transition-transform duration-200 group-hover/child:-translate-y-0.5 group-hover/child:translate-x-0.5 group-hover/child:opacity-80 rtl:-scale-x-100"
      />
    </a>
  ) : (
    <Link href={child.href} aria-current={active ? 'page' : undefined} className={className}>
      {child.label}
      {active && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
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
          'relative flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
          hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        )}
      >
        {hasActiveChild && <MobileActiveDot />}
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
            <div className="ms-4 flex flex-col gap-0.5 border-s border-border/70 pb-1 pe-1 ps-2 pt-0.5">
              <Stagger gap={0.03} maxDelay={0.2}>
                {item.children.map((child, i) => {
                  const active = isActiveRoute(child.href, pathname, search);
                  return (
                    <StaggerItem as="div" key={child.id} index={i}>
                      <Link
                        href={child.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex rounded-lg px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-primary/[0.07] font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
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
  const [hovered, setHovered] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <LayoutGroup id="primary-nav">
      <nav
        className="hidden items-center gap-0.5 md:flex"
        aria-label="Primary"
        onMouseLeave={() => setHovered(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(null);
        }}
      >
        {items.map((item) =>
          item.type === 'group' ? (
            <DesktopDropdown
              key={item.id}
              item={item}
              pathname={pathname}
              search={search}
              hovered={hovered === item.id}
              onHover={setHovered}
            />
          ) : (
            <DesktopLink
              key={item.id}
              item={item}
              pathname={pathname}
              search={search}
              hovered={hovered === item.id}
              onHover={setHovered}
            />
          ),
        )}
      </nav>
    </LayoutGroup>
  );
}

function DesktopLink({
  item,
  pathname,
  search,
  hovered,
  onHover,
}: {
  item: NavItemView;
  pathname: string;
  search: string;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const active = isActiveRoute(item.href, pathname, search);
  const hoverProps = {
    onMouseEnter: () => onHover(item.id),
    onFocus: () => onHover(item.id),
  };
  if (item.openInNewTab || /^https?:\/\//.test(item.href)) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        {...hoverProps}
        className={cn(NAV_ITEM_CLASS, 'text-muted-foreground hover:text-foreground')}
      >
        <AnimatePresence>{hovered && <HoverPill />}</AnimatePresence>
        {item.label}
        <ArrowUpRight aria-hidden className="size-3 opacity-50 rtl:-scale-x-100" />
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      {...hoverProps}
      className={cn(
        NAV_ITEM_CLASS,
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <AnimatePresence>{hovered && <HoverPill />}</AnimatePresence>
      {item.label}

      {/* One shared indicator that MORPHS between items rather than a per-item
          underline that fades in and out: moving from "Courses" to "Academy"
          slides the clay rule across. `layoutId` has to be unique among
          simultaneously mounted elements — only one item is ever active. */}
      {active && <ActiveRule />}
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
      {items.map((item, i) => (
        <StaggerItem key={item.id} index={i}>
          {item.type === 'group' ? (
            <MobileGroup
              item={item}
              pathname={pathname}
              search={search}
              defaultOpen={item.children.some((child) =>
                isActiveRoute(child.href, pathname, search),
              )}
            />
          ) : (
            <MobileLink item={item} pathname={pathname} search={search} onNavigate={onNavigate} />
          )}
        </StaggerItem>
      ))}
    </>
  );
}

/** Clay marker on the current mobile row; slides between rows on route change. */
function MobileActiveDot() {
  return (
    <m.span
      layoutId="mobile-nav-indicator"
      aria-hidden
      className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-primary"
      transition={spring.smooth}
    />
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
    'group/mlink relative flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
    active
      ? 'bg-muted/70 text-foreground'
      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
  );
  if (item.openInNewTab || /^https?:\/\//.test(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {item.label}
        <ArrowUpRight aria-hidden className="size-4 opacity-50 rtl:-scale-x-100" />
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
      {active && <MobileActiveDot />}
      {item.label}
      <ChevronRight
        aria-hidden
        className="size-4 opacity-40 transition-transform duration-200 group-hover/mlink:translate-x-0.5 rtl:rotate-180"
      />
    </Link>
  );
}
