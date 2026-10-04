import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  MapPin,
  Monitor,
  Users,
} from 'lucide-react';
import { EventsBoard } from '@/components/events/events-board';
import { getImageSrc } from '@/lib/images';
import type { CatalogEvent } from '@/lib/events';
import { cn } from '@/lib/utils';

function dayParts(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    year: d.getFullYear(),
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function placeLabel(event: CatalogEvent) {
  if (event.isVirtual) return 'Online';
  const loc = event.location;
  if (!loc) return 'TBD';
  if (loc.city) return `${loc.city}${loc.state ? `, ${loc.state}` : ''}`;
  return loc.venue || 'TBD';
}

function seatsLabel(event: CatalogEvent) {
  if (!event.maxAttendees) return 'Open seats';
  const left = Math.max(0, event.maxAttendees - event.registeredCount);
  if (left === 0) return 'Full';
  return `${left} seats left`;
}

function groupKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function EventDateBlock({ iso }: { iso: string }) {
  const p = dayParts(iso);
  return (
    <div
      aria-hidden
      className="flex w-16 shrink-0 flex-col items-center rounded-md border border-border bg-card py-2 shadow-xs"
    >
      <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-primary">
        {p.month}
      </span>
      <span className="font-display text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
        {p.day}
      </span>
      <span className="font-mono text-[9px] font-semibold tracking-[0.1em] text-muted-foreground">
        {p.weekday}
      </span>
    </div>
  );
}

function ScheduleRow({ event }: { event: CatalogEvent }) {
  const seats = seatsLabel(event);
  const full = seats === 'Full';

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-start gap-4 border-b border-border px-3 py-4 transition-colors last:border-b-0 hover:bg-surface-sunken/60 sm:gap-5 sm:px-5"
    >
      <EventDateBlock iso={event.startDate} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary capitalize">
            {event.eventType}
          </span>
          {event.isVirtual ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Monitor className="size-3" />
              Online
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 font-display text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-lg">
          {event.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0 text-primary" />
            {formatTime(event.startDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {event.isVirtual ? (
              <Monitor className="size-3.5 shrink-0 text-primary" />
            ) : (
              <MapPin className="size-3.5 shrink-0 text-primary" />
            )}
            {placeLabel(event)}
          </span>
          <span
            className={cn('inline-flex items-center gap-1.5', full && 'text-destructive')}
          >
            <Users className="size-3.5 shrink-0" />
            {seats}
          </span>
        </div>
      </div>
      <span className="mt-2 hidden shrink-0 items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary opacity-0 transition group-hover:opacity-100 sm:inline-flex">
        Details
        <ArrowRight className="size-3.5 rtl:rotate-180" />
      </span>
    </Link>
  );
}

function NextUpCard({ event }: { event: CatalogEvent }) {
  const p = dayParts(event.startDate);
  const seats = seatsLabel(event);
  const full = seats === 'Full';

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group grid overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors hover:border-primary/40 md:grid-cols-[220px_minmax(0,1fr)]"
    >
      <div className="relative min-h-[180px] border-b border-border bg-surface-sunken md:border-b-0 md:border-e">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getImageSrc(event.thumbnailUrl, 'event')}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute start-3 top-3 flex flex-col items-center rounded-md border border-white/15 bg-overlay px-3 py-2 text-white shadow-sm">
          <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-primary">
            {p.month}
          </span>
          <span className="font-display text-3xl font-bold leading-none tabular-nums">{p.day}</span>
          <span className="font-mono text-[9px] font-semibold tracking-[0.1em] text-white/70">
            {p.weekday} {p.year}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground capitalize">
            {event.eventType}
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Next up
          </span>
        </div>
        <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary md:text-2xl">
          {event.title}
        </h3>
        {event.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            {formatTime(event.startDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {event.isVirtual ? (
              <Monitor className="size-4 text-primary" />
            ) : (
              <MapPin className="size-4 text-primary" />
            )}
            {placeLabel(event)}
          </span>
          <span className={cn('inline-flex items-center gap-1.5', full && 'text-destructive')}>
            <Users className="size-4" />
            {seats}
          </span>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          View &amp; register
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </span>
      </div>
    </Link>
  );
}

function upcomingList(events: CatalogEvent[], upcoming: CatalogEvent[]) {
  const now = Date.now();
  return upcoming.length ? upcoming : events.filter((e) => new Date(e.startDate).getTime() >= now);
}

/** Format ticker — the `events-ticker` island. */
export function EventsFormatTicker({
  events,
}: {
  events: CatalogEvent[];
}) {
  if (events.length === 0) return null;
  return (
    <div className="relative border-y border-border bg-overlay text-white">
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex items-stretch overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-e border-white/10 py-2.5 pe-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          On the board
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max gap-8 py-2.5 ps-4 [animation:marquee_45s_linear_infinite] hover:[animation-play-state:paused]">
            {[...events.slice(0, 10), ...events.slice(0, 10)].map((e, i) => (
              <span
                key={`${e.id}-${i}`}
                className="inline-flex max-w-md shrink-0 items-center gap-2 font-mono text-xs text-white/70"
              >
                <span className="text-primary">›</span>
                <span className="capitalize text-primary/90">{e.eventType}</span>
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
export function EventsNextUp({
  events,
  upcoming,
}: {
  events: CatalogEvent[];
  upcoming: CatalogEvent[];
}) {
  const list = upcomingList(events, upcoming);
  const nextEvent = list[0] ?? null;
  if (!nextEvent) return null;

  return (
    <section
      id="next-up"
      className="border-b border-border bg-surface-sunken/50 px-margin-mobile md:px-margin-desktop py-12 md:py-16"
    >
      <div className="max-w-container-max mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Next on the board
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Don&apos;t miss the next one
            </h2>
          </div>
          <a
            href="#browse"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary"
          >
            Full board
            <ArrowRight className="flip-rtl size-3.5" />
          </a>
        </div>
        <NextUpCard event={nextEvent} />
      </div>
    </section>
  );
}

/** Chronological schedule rail + side rail — the `events-schedule` island. */
export function EventsSchedule({
  events,
  upcoming,
}: {
  events: CatalogEvent[];
  upcoming: CatalogEvent[];
}) {
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
      groups.push({ key, label: monthLabel(event.startDate), items: [event] });
    }
  }

  return (
    <section
      id="schedule"
      className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-6 max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Schedule
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              What&apos;s coming up
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ordered by date — workshops, webinars, and meets as they land on the board.
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Nothing scheduled yet — check the full board or past events below.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 border-b border-border bg-surface-sunken/60 px-3 py-2.5 sm:px-5">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground tabular-nums">
                      {group.items.length} event{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {group.items.map((event) => (
                    <ScheduleRow key={event.id} event={event} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Board status
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                { label: 'Upcoming', value: list.length },
                { label: 'Past listed', value: past.length },
                { label: 'Formats', value: typeCount },
                { label: 'Free events', value: freeCount },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {past.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Recently past
              </p>
              <ul className="mt-3 space-y-2">
                {past.slice(0, 5).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.slug}`}
                      className="group flex items-start justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-surface-sunken"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-foreground group-hover:text-primary">
                          {event.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {new Date(event.startDate).toLocaleDateString('en-US', {
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
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Take it further
            </p>
            <ul className="mt-3 space-y-2">
              {[
                { href: '/academy', label: 'Academy pathways' },
                { href: '/products', label: 'Tool crib' },
                { href: '/feed', label: 'Community wire' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-surface-sunken"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 text-primary opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Full events board island — the `events-browse` island. */
export function EventsBrowse() {
  return (
    <section
      id="browse"
      className="border-y border-border bg-surface-sunken/50 px-margin-mobile md:px-margin-desktop py-16 md:py-20"
    >
      <div className="max-w-container-max mx-auto">
        <div className="mb-6 max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Full board
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Browse every event
          </h2>
          <p className="mt-3 text-muted-foreground">
            Filter by format, toggle upcoming vs past, search by city or title — live from the
            events API.
          </p>
        </div>
        <EventsBoard />
      </div>
    </section>
  );
}

/** Hero stats helper shared by the events route (live counters). */
export function eventsHeroStats(
  events: CatalogEvent[],
  upcoming: CatalogEvent[],
): { label: string; value: string }[] {
  const list = upcomingList(events, upcoming);
  const typeCount = new Set(events.map((e) => e.eventType)).size;
  const cityCount = new Set(
    events
      .filter((e) => !e.isVirtual)
      .map((e) => e.location?.city)
      .filter(Boolean),
  ).size;
  const freeCount = events.filter((e) => !e.price || e.price === 0).length;
  return [
    { label: 'Upcoming', value: String(list.length) },
    { label: 'Formats', value: String(typeCount || '—') },
    { label: 'Cities', value: String(cityCount || 'Online') },
    { label: 'Free seats', value: String(freeCount) },
  ];
}
