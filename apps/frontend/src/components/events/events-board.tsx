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
import { Crossfade, HoverLift, Stagger, StaggerItem } from '@/components/ui/motion';
import { Switch } from '@/components/ui/switch';
import { ActivePill } from '@/components/feed/feed-motion';

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
  const tu = useTranslations('ui.events');
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
    <div id="events-board" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 hidden text-xs font-medium text-muted-foreground sm:inline">
            {tu('typeLabel')}
          </span>
          {EVENT_TYPES.map((et) => {
            const active = type === et;
            return (
              <button
                key={et}
                type="button"
                onClick={() => setType(et)}
                aria-pressed={active}
                className={cn(
                  'relative inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-transparent text-primary'
                    : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                {active && (
                  <ActivePill layoutId="events-type-pill" className="bg-primary/10 shadow-none ring-primary/25" />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  <span className="capitalize">{et === 'All' ? tc('all') : et}</span>
                  {!active || et !== 'All' ? (
                    <span
                      className={cn(
                        'tabular-nums',
                        active ? 'text-primary/70' : 'text-muted-foreground/60',
                      )}
                    >
                      {et === 'All' ? (counts.All ?? 0) : (counts[et] ?? 0)}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-2.5">
            <Switch
              id="events-upcoming-only"
              checked={upcoming}
              onCheckedChange={setUpcoming}
            />
            <label
              htmlFor="events-upcoming-only"
              className="cursor-pointer text-sm text-muted-foreground"
            >
              {tu('upcomingOnly', { label: t('upcoming') })}
            </label>
          </div>
          <div className="relative w-full md:w-60">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={tu('searchPlaceholder')}
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5 md:px-6">
        <p className="text-xs text-muted-foreground">
          {!loading && !error ? tu('resultCount', { count: events.length }) : ' '}
          {type !== 'All' ? ` · ${type}` : ''}
          {search ? ` · “${search}”` : ''}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          {tu('liveFromApi')}
        </p>
      </div>

      {/* Results */}
      <div className="p-4 md:p-6">
        <Crossfade value={`${type}-${upcoming}-${loading ? 'l' : error ? 'e' : events.length === 0 ? '0' : 'list'}`} axis="none">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl" />
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
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            gap={0.035}
            maxDelay={0.28}
          >
            {events.map((event, i) => {
              const seats = seatLabel(event);
              const full = seats === 'Full';
              const start = new Date(event.startDate);
              return (
                <StaggerItem as="li" key={event.id} index={i}>
                  <HoverLift className="h-full" lift={3}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg"
                  >
                    <div className="relative aspect-video overflow-hidden border-b border-border/60 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageSrc(event.thumbnailUrl, 'event')}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <div className="absolute start-3 top-3 flex flex-wrap gap-1">
                        <span className="rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-medium capitalize text-foreground shadow-xs ring-1 ring-border/50 backdrop-blur">
                          {event.eventType}
                        </span>
                        {event.isVirtual ? (
                          <span className="rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-xs ring-1 ring-border/50 backdrop-blur">
                            {t('online')}
                          </span>
                        ) : null}
                        {full ? (
                          <span className="rounded-full bg-destructive/90 px-2.5 py-0.5 text-xs font-medium text-destructive-foreground shadow-xs">
                            Full
                          </span>
                        ) : null}
                      </div>
                      {!Number.isNaN(start.getTime()) && (
                        <div
                          aria-hidden
                          className="absolute bottom-3 end-3 flex min-w-12 flex-col items-center rounded-lg bg-card/95 px-2 py-1 leading-none shadow-sm ring-1 ring-border/50 backdrop-blur"
                        >
                          <span className="text-[10px] font-medium text-primary">
                            {start.toLocaleDateString(locale, { month: 'short' })}
                          </span>
                          <span className="mt-0.5 font-display text-lg font-medium tabular-nums text-foreground">
                            {start.toLocaleDateString(locale, { day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <h3 className="font-display text-lg font-medium leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                        {event.title}
                      </h3>
                      <ul className="mt-auto space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Clock className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {formatDay(event.startDate, locale)} ·{' '}
                            {formatTime(event.startDate, locale)}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {event.isVirtual ? (
                            <Monitor className="size-3.5 shrink-0" />
                          ) : (
                            <MapPin className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{placeLabel(event)}</span>
                        </li>
                        {seats ? (
                          <li className="flex items-center gap-2">
                            <Users className="size-3.5 shrink-0" />
                            <span className={cn(full && 'text-destructive')}>{seats}</span>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </Link>
                  </HoverLift>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
        </Crossfade>
      </div>
    </div>
  );
}
