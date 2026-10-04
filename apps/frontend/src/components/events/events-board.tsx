'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarDays, Clock, MapPin, Monitor, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { getImageSrc } from '@/lib/images';
import type { CatalogEvent } from '@/lib/events';
import { cn } from '@/lib/utils';
import { Stagger, StaggerItem } from '@/components/ui/motion';

const EVENT_TYPES = [
  'All',
  'workshop',
  'webinar',
  'conference',
  'competition',
  'meetup',
  'course',
] as const;

type TypeFilter = (typeof EVENT_TYPES)[number];

function formatDay(dateIso: string, locale: string) {
  return new Date(dateIso).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateIso: string, locale: string) {
  return new Date(dateIso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function placeLabel(event: CatalogEvent) {
  if (event.isVirtual) return 'Online';
  const loc = event.location;
  if (!loc) return 'TBD';
  if (loc.city) return `${loc.city}${loc.state ? `, ${loc.state}` : ''}`;
  return loc.venue || 'TBD';
}

function seatLabel(event: CatalogEvent) {
  if (!event.maxAttendees) return null;
  const remaining = Math.max(0, event.maxAttendees - event.registeredCount);
  if (remaining === 0) return 'Full';
  return `${remaining} seats left`;
}

/**
 * Live schedule board — client island for type/upcoming/search filters.
 * Rendered inside the builder-driven events page (events-browse island).
 */
export function EventsBoard({ locale = 'en' }: { locale?: string }) {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TypeFilter>('All');
  const [upcoming, setUpcoming] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (type !== 'All') params.set('type', type);
    if (upcoming) params.set('upcoming', 'true');
    params.set('limit', '50');
    fetch(`/api/proxy/events?${params}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(t('loadFailed'));
        return r.json();
      })
      .then((res) => {
        const rows: CatalogEvent[] = res.data || [];
        const q = search.trim().toLowerCase();
        setEvents(
          q
            ? rows.filter((e) =>
                [e.title, e.eventType, placeLabel(e)].join(' ').toLowerCase().includes(q),
              )
            : rows,
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [type, upcoming]);

  const counts = EVENT_TYPES.reduce<Record<string, number>>((acc, key) => {
    acc[key] = key === 'All' ? events.length : events.filter((e) => e.eventType === key).length;
    return acc;
  }, {});

  return (
    <div id="events-board" className="rounded-lg border border-border bg-card shadow-xs">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="me-1 hidden font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:inline">
            Type
          </span>
          {EVENT_TYPES.map((et) => {
            const active = type === et;
            return (
              <button
                key={et}
                type="button"
                onClick={() => setType(et)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface-sunken/60 text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                <span className="capitalize">{et === 'All' ? tc('all') : et}</span>
                {!active || et !== 'All' ? (
                  <span
                    className={cn(
                      'tabular-nums',
                      active ? 'text-primary-foreground/70' : 'text-muted-foreground/70',
                    )}
                  >
                    {et === 'All' ? (counts.All ?? 0) : (counts[et] ?? 0)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <input
              type="checkbox"
              checked={upcoming}
              onChange={(e) => setUpcoming(e.target.checked)}
              className="size-3.5 rounded accent-[var(--color-primary)]"
            />
            {t('upcoming')} only
          </label>
          <div className="relative w-full md:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
              onBlur={load}
              className="ps-9"
              aria-label={t('title')}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
        </div>
      </div>

      {/* Result meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sunken/40 px-4 py-2.5 md:px-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {!loading && !error ? `${events.length} result${events.length === 1 ? '' : 's'}` : ' '}
          {type !== 'All' ? ` · ${type}` : ''}
          {search ? ` · “${search}”` : ''}
        </p>
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <CalendarDays className="size-3 text-primary" />
          Live from events API
        </p>
      </div>

      {/* Results */}
      <div className="p-4 md:p-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title={t('loadFailed')} description={error} onRetry={load} />
        ) : events.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('noEvents')} description={tc('noResultsHint')} />
        ) : (
          <Stagger
            as="ul"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            gap={0.035}
            maxDelay={0.28}
          >
            {events.map((event, i) => {
              const seats = seatLabel(event);
              const full = seats === 'Full';
              return (
                <StaggerItem as="li" key={event.id} index={i}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface-sunken/40 transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-video overflow-hidden border-b border-border bg-surface-sunken">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageSrc(event.thumbnailUrl, 'event')}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute start-3 top-3 flex flex-wrap gap-1">
                        <span className="rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground capitalize">
                          {event.eventType}
                        </span>
                        {event.isVirtual ? (
                          <span className="rounded-sm border border-white/20 bg-overlay px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                            {t('online')}
                          </span>
                        ) : null}
                        {full ? (
                          <span className="rounded-sm bg-destructive px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-destructive-foreground">
                            Full
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {event.title}
                      </h3>
                      <ul className="mt-auto space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Clock className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate">
                            {formatDay(event.startDate, locale)} ·{' '}
                            {formatTime(event.startDate, locale)}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {event.isVirtual ? (
                            <Monitor className="size-3.5 shrink-0 text-primary" />
                          ) : (
                            <MapPin className="size-3.5 shrink-0 text-primary" />
                          )}
                          <span className="truncate">{placeLabel(event)}</span>
                        </li>
                        {seats ? (
                          <li className="flex items-center gap-2">
                            <Users className="size-3.5 shrink-0 text-primary" />
                            <span className={cn(full && 'text-destructive')}>{seats}</span>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>
    </div>
  );
}
