import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  Clock,
  MapPin,
  Monitor,
  Users,
} from 'lucide-react';
import { getLocale } from 'next-intl/server';
import { EventsBoard } from '@/components/events/events-board';
import { getImageSrc } from '@/lib/images';
import type { CatalogEvent } from '@/lib/events';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

type IslandChrome = {
  /** Builder-authored header nodes. Arabic pages omit it and keep the translated header. */
  header?: ReactNode;
  /** Builder canvas preview: render the live rows without the header. */
  bodyOnly?: boolean;
  /**
   * Canvas-only: reserve the authored header's height inside the public grid
   * while the editable header is overlaid on top of the iframe. Without this,
   * a header that lives in the main column of a side-rail grid is counted
   * outside the grid and makes the canvas section taller than the public one.
   */
  headerSpacerHeight?: number;
};

function dayParts(iso: string, locale = 'en') {
  const d = new Date(iso);
  return {
    month: formatDate(d, locale, { month: 'short' }),
    day: String(d.getDate()).padStart(2, '0'),
    weekday: formatDate(d, locale, { weekday: 'short' }),
    year: d.getFullYear(),
  };
}

function formatTime(iso: string, locale = 'en') {
  return formatDate(iso, locale, { hour: 'numeric', minute: '2-digit' });
}

function placeLabel(event: CatalogEvent, t: Translator) {
  if (event.isVirtual) return t('online');
  const loc = event.location;
  if (!loc) return t('tbd');
  if (loc.city) return `${loc.city}${loc.state ? `, ${loc.state}` : ''}`;
  return loc.venue || t('tbd');
}

/**
 * Loose translator shape: the concrete next-intl translator is generic per key and its
 * value type is narrower, so a plain `(key, values) => string` would reject it.
 */
type Translator = (key: string, values?: Record<string, string | number | Date>) => any;

/**
 * `full` is derived from the counts, never from the rendered label.
 *
 * It used to be `seats === 'Full'`, which meant translating the label silently turned
 * every sold-out event back into an open one. Data decides, the string is display only.
 */
function seatsInfo(event: CatalogEvent, t: Translator) {
  if (!event.maxAttendees) return { full: false, label: t('openSeats') };
  const left = Math.max(0, event.maxAttendees - event.registeredCount);
  if (left === 0) return { full: true, label: t('full') };
  return { full: false, label: t('seatsLeft', { count: left }) };
}

function groupKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function monthLabel(iso: string, locale = 'en') {
  return formatDate(iso, locale, { month: 'long', year: 'numeric' });
}

function EventDateBlock({ iso, locale }: { iso: string; locale: string }) {
  const p = dayParts(iso, locale);
  return (
    <div
      aria-hidden
      className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 group-hover:border-border group-hover:shadow-sm"
    >
      <span className="w-full bg-primary/10 py-1 text-center text-[11px] font-medium text-primary">
        {p.month}
      </span>
      <span className="pt-1.5 font-display text-2xl font-medium leading-none tracking-[-0.02em] text-foreground tabular-nums">
        {p.day}
      </span>
      <span className="pb-1.5 pt-1 text-[10px] text-muted-foreground">
        {p.weekday}
      </span>
    </div>
  );
}

function ScheduleRow({ event, locale, t }: { event: CatalogEvent; locale: string; t: Translator }) {
  const { full, label: seats } = seatsInfo(event, t);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-start gap-4 border-b border-border/60 px-4 py-5 transition-colors last:border-b-0 hover:bg-muted/40 sm:gap-5 sm:px-6"
    >
      <EventDateBlock iso={event.startDate} locale={locale} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {event.eventType}
          </span>
          {event.isVirtual ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Monitor className="size-3" />
              Online
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 font-display text-lg font-medium leading-snug tracking-[-0.012em] text-foreground transition-colors group-hover:text-primary">
          {event.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" />
            {formatTime(event.startDate, locale)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {event.isVirtual ? (
              <Monitor className="size-3.5 shrink-0" />
            ) : (
              <MapPin className="size-3.5 shrink-0" />
            )}
            {placeLabel(event, t)}
          </span>
          <span
            className={cn('inline-flex items-center gap-1.5', full && 'text-destructive')}
          >
            <Users className="size-3.5 shrink-0" />
            {seats}
          </span>
        </div>
      </div>
      <span className="mt-2 hidden shrink-0 -translate-x-1 items-center gap-1 text-sm font-medium text-primary opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 rtl:translate-x-1 sm:inline-flex">
        Details
        <ArrowRight className="size-3.5 rtl:rotate-180" />
      </span>
    </Link>
  );
}

function NextUpCard({ event, locale, t }: { event: CatalogEvent; locale: string; t: Translator }) {
  const p = dayParts(event.startDate, locale);
  const { full, label: seats } = seatsInfo(event, t);

  return (
    <HoverLift lift={3}>
    <Link
      href={`/events/${event.slug}`}
      className="group grid overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg md:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div className="relative min-h-[200px] overflow-hidden border-b border-border/60 bg-muted md:border-b-0 md:border-e">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getImageSrc(event.thumbnailUrl, 'event')}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute start-3 top-3 flex min-w-16 flex-col items-center overflow-hidden rounded-xl bg-card/95 text-foreground shadow-md ring-1 ring-border/50 backdrop-blur">
          <span className="w-full bg-primary/10 py-1 text-center text-[11px] font-medium text-primary">
            {p.month}
          </span>
          <span className="px-3 pt-1.5 font-display text-3xl font-medium leading-none tracking-[-0.02em] tabular-nums">{p.day}</span>
          <span className="px-3 pb-1.5 pt-1 text-[10px] text-muted-foreground">
            {p.weekday} {p.year}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {event.eventType}
          </span>
          <span className="eyebrow">
            Next up
          </span>
        </div>
        <h3 className="text-balance font-display text-2xl font-medium leading-snug tracking-[-0.018em] text-foreground transition-colors group-hover:text-primary md:text-3xl">
          {event.title}
        </h3>
        {event.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" />
            {formatTime(event.startDate, locale)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {event.isVirtual ? (
              <Monitor className="size-4" />
            ) : (
              <MapPin className="size-4" />
            )}
            {placeLabel(event, t)}
          </span>
          <span className={cn('inline-flex items-center gap-1.5', full && 'text-destructive')}>
            <Users className="size-4" />
            {seats}
          </span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          View &amp; register
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
    </HoverLift>
  );
}

function upcomingList(events: CatalogEvent[], upcoming: CatalogEvent[]) {
  const now = Date.now();
  return upcoming.length ? upcoming : events.filter((e) => new Date(e.startDate).getTime() >= now);
}

/** Format ticker — the `events-ticker` island. */
export async function EventsFormatTicker({
  events,
}: {
  events: CatalogEvent[];
}) {
  const t = await getTranslations('pages.events');
  if (events.length === 0) return null;
  return (
    <div className="relative border-y border-border/70 bg-card text-foreground">
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex items-stretch overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-e border-border/70 py-3 pe-4 text-xs font-medium text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('tickerHeading')}
        </div>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <div className="flex w-max gap-10 py-3 ps-4 [animation:marquee_45s_linear_infinite] hover:[animation-play-state:paused]">
            {[...events.slice(0, 10), ...events.slice(0, 10)].map((e, i) => (
              <span
                key={`${e.id}-${i}`}
                className="inline-flex max-w-md shrink-0 items-center gap-2.5 text-sm text-muted-foreground"
              >
                <span className="size-1 rounded-full bg-primary/60" aria-hidden />
                <span className="font-medium capitalize text-foreground">{e.eventType}</span>
                <span className="truncate">{e.title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Next event spotlight — the `events-next-up` island. */
export async function EventsNextUp({
  events,
  upcoming,
  header,
  bodyOnly,
}: {
  events: CatalogEvent[];
  upcoming: CatalogEvent[];
} & IslandChrome) {
  const locale = await getLocale();
  const t = await getTranslations('pages.events');
  const list = upcomingList(events, upcoming);
  const nextEvent = list[0] ?? null;
  if (!nextEvent) return null;

  return (
    <section
      id="next-up"
      className={cn(
        'border-b border-border/70 bg-surface-sunken/40 px-margin-mobile md:px-margin-desktop py-16 md:py-20',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      <div className="max-w-container-max mx-auto">
        {bodyOnly
          ? null
          : header ?? (
              <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">{t('nextUpHeading')}</p>
                  <h2 className="mt-3 text-balance font-display text-2xl font-medium tracking-[-0.018em] text-foreground md:text-3xl">
                    Don&apos;t miss the next one
                  </h2>
                </div>
                <a
                  href="#browse"
                  className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Full board
                  <ArrowRight className="flip-rtl size-3.5" />
                </a>
              </Reveal>
            )}
        <Reveal>
          <NextUpCard event={nextEvent} locale={locale} t={t} />
        </Reveal>
      </div>
    </section>
  );
}

/** Chronological schedule rail + side rail — the `events-schedule` island. */
export async function EventsSchedule({
  events,
  upcoming,
  header,
  bodyOnly,
  headerSpacerHeight = 0,
}: {
  events: CatalogEvent[];
  upcoming: CatalogEvent[];
} & IslandChrome) {
  const locale = await getLocale();
  const t = await getTranslations('pages.events');
  const now = Date.now();
  const list = upcomingList(events, upcoming);
  const past = events
    .filter((e) => new Date(e.startDate).getTime() < now)
    .slice()
    .reverse();
  const scheduleEvents = list.slice(0, 8);
  const typeCount = new Set(events.map((e) => e.eventType)).size;
  const freeCount = events.filter((e) => !e.price || e.price === 0).length;

  const groups: { key: string; label: string; items: CatalogEvent[] }[] = [];
  for (const event of scheduleEvents) {
    const key = groupKey(event.startDate);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(event);
    } else {
      groups.push({ key, label: monthLabel(event.startDate, locale), items: [event] });
    }
  }

  return (
    <section
      id="schedule"
      className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-24"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start xl:gap-12">
        <div className="min-w-0">
          {bodyOnly ? (
            headerSpacerHeight > 0 ? (
              <div style={{ height: headerSpacerHeight }} aria-hidden="true" />
            ) : null
          ) : (
            header ?? (
              <Reveal className="mb-8 max-w-2xl">
                <p className="eyebrow">Schedule</p>
                <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl">
                  What&apos;s coming up
                </h2>
                <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
                  Ordered by date — workshops, webinars, and meets as they land on the board.
                </p>
              </Reveal>
            )
          )}

          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
              Nothing scheduled yet — check the full board or past events below.
            </div>
          ) : (
            <Stagger inViewOnly className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
              {groups.map((group, gi) => (
                <StaggerItem key={group.key} index={gi}>
                  <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 sm:px-6">
                    <span className="font-display text-sm font-medium text-foreground">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-border/70" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {group.items.length} event{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {group.items.map((event) => (
                    <ScheduleRow key={event.id} event={event} locale={locale} t={t} />
                  ))}
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Reveal className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <h3 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              Board status
            </h3>
            <ul className="mt-3 divide-y divide-border/60">
              {[
                { label: 'Upcoming', value: list.length },
                { label: 'Past listed', value: past.length },
                { label: 'Formats', value: typeCount },
                { label: 'Free events', value: freeCount },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-display text-lg font-medium text-foreground tabular-nums">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {past.length > 0 ? (
            <Reveal delay={0.05} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
              <h3 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
                Recently past
              </h3>
              <ul className="mt-3 space-y-0.5">
                {past.slice(0, 5).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.slug}`}
                      className="group -mx-2 flex items-start justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-foreground group-hover:text-primary">
                          {event.title}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {formatDate(event.startDate, locale, {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          · {event.eventType}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          <Reveal delay={0.1} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <h3 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              Take it further
            </h3>
            <ul className="mt-3 space-y-0.5">
              {[
                { href: '/academy', label: 'Academy pathways' },
                { href: '/products', label: 'Tool crib' },
                { href: '/feed', label: 'Community wire' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group -mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/70"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 -translate-x-1 text-primary opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </aside>
      </div>
    </section>
  );
}

/** Full events board island — the `events-browse` island. */
export function EventsBrowse({ header, bodyOnly }: IslandChrome) {
  return (
    <section
      id="browse"
      className={cn(
        'border-y border-border/70 bg-surface-sunken/40 px-margin-mobile md:px-margin-desktop py-16 md:py-24',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      <div className="max-w-container-max mx-auto">
        {bodyOnly
          ? null
          : header ?? (
              <Reveal className="mb-8 max-w-2xl">
                <p className="eyebrow">Full board</p>
                <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl">
                  Browse every event
                </h2>
                <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
                  Filter by format, toggle upcoming vs past, search by city or title — live from
                  the events API.
                </p>
              </Reveal>
            )}
        <EventsBoard />
      </div>
    </section>
  );
}

/**
 * Hero stats helper shared by the events route (live counters).
 *
 * The implementation lives in `lib/catalog-stats` so the builder canvas can use
 * the exact same arithmetic without importing this server module.
 */
export { eventsHeroStats } from '@/lib/catalog-stats';
