'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Users } from 'lucide-react';
import { getImageSrc } from '@/lib/images';
import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState } from '@/components/ui/states';

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
    fetch(`/api/proxy/events?${params}`, { credentials: 'include' })
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
    <section id="events-browse" className="container mx-auto px-4 py-16">
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex gap-2 flex-wrap">
          {eventTypes.map((et) => (
            <button
              key={et}
              type="button"
              onClick={() => {
                setType(et);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${type === et ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
            >
              {et}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm ms-auto">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => {
              setUpcoming(e.target.checked);
              setPage(1);
            }}
            className="rounded"
          />
          Upcoming only
        </label>
      </div>

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
                <Link href={`/events/${event.slug}`} className="block h-full">
                  <Card className="group overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all h-full flex flex-col">
                    <div className="aspect-video bg-muted blueprint-grid relative overflow-hidden">
                      <img
                        src={getImageSrc(event.thumbnailUrl, 'event')}
                        alt={event.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-3 start-3 flex gap-1">
                        <Badge className="capitalize">{event.eventType}</Badge>
                        {event.isVirtual && <Badge variant="secondary">Virtual</Badge>}
                        {isFull && <Badge variant="destructive">Full</Badge>}
                      </div>
                    </div>
                    <CardHeader className="flex-1">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="size-4 shrink-0" />
                          {new Date(event.startDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {event.endDate &&
                            ` — ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
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
                          <p className="font-semibold text-primary">
                            ${(event.price / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardFooter>
                      <Button className="w-full" variant={isFull ? 'secondary' : 'default'} asChild>
                        <span>{isFull ? 'Full' : 'Register'}</span>
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

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
