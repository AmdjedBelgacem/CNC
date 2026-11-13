'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crossfade, HoverLift, Stagger, StaggerItem } from '@/components/ui/motion';
import { Switch } from '@/components/ui/switch';
import { ActivePill } from '@/components/feed/feed-motion';
import { cn } from '@/lib/utils';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Users } from 'lucide-react';
import { getImageSrc } from '@/lib/images';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';

interface EventData {
  id: string;
  title: string;
  slug: string;
  eventType: string;
  startDate: string;
  endDate: string | null;
  location: { venue?: string; address?: string; city?: string; state?: string } | null;
  isVirtual: boolean;
  maxAttendees: number | null;
  price: number | null;
  thumbnailUrl: string | null;
  registeredCount: number;
}

const eventTypes = ['All', 'workshop', 'webinar', 'conference', 'competition', 'meetup'];
const PAGE_SIZE = 9;

export function EventsDirectory() {
  const t = useTranslations('events');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [events, setEvents] = useState<EventData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('All');
  const [upcoming, setUpcoming] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== 'All') params.set('type', type);
    if (upcoming) params.set('upcoming', 'true');
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    setError(null);
    fetchWithRefresh(`/api/proxy/events?${params}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(t('loadFailed'));
        return r.json();
      })
      .then((res) => {
        setEvents(res.data || []);
        setTotal(Number(res.total ?? 0));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type, upcoming, page, t]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section id="events-browse" className="container mx-auto px-4 py-16 md:py-24">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {eventTypes.map((et) => (
            <button
              key={et}
              type="button"
              onClick={() => {
                setType(et);
                setPage(1);
              }}
              aria-pressed={type === et}
              className={cn(
                'relative rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
                type === et
                  ? 'border-transparent text-primary'
                  : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {type === et && (
                <ActivePill layoutId="events-directory-pill" className="bg-primary/10 shadow-none ring-primary/25" />
              )}
              <span className="relative">{et}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5 sm:ms-auto">
          <Switch
            id="events-directory-upcoming"
            checked={upcoming}
            onCheckedChange={(checked) => {
              setUpcoming(checked);
              setPage(1);
            }}
          />
          <label htmlFor="events-directory-upcoming" className="cursor-pointer text-sm text-muted-foreground">
            Upcoming only
          </label>
        </div>
      </div>

      <Crossfade value={`${type}-${upcoming}-${page}-${loading ? 'l' : error ? 'e' : events.length === 0 ? '0' : 'list'}`} axis="none">
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title={t('loadFailed')}
          description={error}
          onRetry={() => {
            setPage(1);
            setUpcoming(upcoming);
          }}
        />
      ) : events.length === 0 ? (
        <EmptyState icon={Calendar} title={t('noEvents')} description={tc('noResultsHint')} />
      ) : (
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" gap={0.04} maxDelay={0.3}>
          {events.map((event, i) => {
            const isFull = event.maxAttendees ? event.registeredCount >= event.maxAttendees : false;
            const loc = event.location as { venue?: string; city?: string; state?: string } | null;
            return (
              <StaggerItem as="div" key={event.id} index={i}>
                <HoverLift className="h-full" lift={3}>
                <Link href={`/events/${event.slug}`} className="block h-full">
                  <Card className="group flex h-full flex-col overflow-hidden rounded-xl border-border/70 shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg">
                    <div className="relative aspect-video overflow-hidden border-b border-border/60 bg-muted">
                      <img
                        src={getImageSrc(event.thumbnailUrl, 'event')}
                        alt={event.title}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <div className="absolute start-3 top-3 flex gap-1">
                        <Badge variant="outline" className="bg-card/90 capitalize backdrop-blur">{event.eventType}</Badge>
                        {event.isVirtual && <Badge variant="soft-muted">Virtual</Badge>}
                        {isFull && <Badge variant="destructive">Full</Badge>}
                      </div>
                    </div>
                    <CardHeader className="flex-1">
                      <CardTitle className="font-display text-lg font-medium leading-snug tracking-[-0.01em] transition-colors group-hover:text-primary">{event.title}</CardTitle>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="size-4 shrink-0" />
                          {formatDate(event.startDate, locale, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {event.endDate &&
                            ` — ${formatDate(event.endDate, locale, { month: 'short', day: 'numeric' })}`}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="size-4 shrink-0" />
                          {event.isVirtual
                            ? 'Online'
                            : loc?.city
                              ? `${loc.city}${loc.state ? `, ${loc.state}` : ''}`
                              : 'TBD'}
                        </div>
                        {event.maxAttendees && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="size-4 shrink-0" /> {event.registeredCount}/
                            {event.maxAttendees} registered
                          </div>
                        )}
                        {event.price && event.price > 0 && (
                          <p className="font-display text-lg font-medium tabular-nums text-foreground">
                            ${(event.price / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardFooter>
                      <Button className="w-full" variant={isFull ? 'subtle' : 'outline'} asChild>
                        <span>{isFull ? 'Full' : 'Register'}</span>
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
                </HoverLift>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
      </Crossfade>

      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages} · {total} events
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
