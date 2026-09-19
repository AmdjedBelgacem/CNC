'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Users } from 'lucide-react';
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
export default function EventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('All');
  const [upcoming, setUpcoming] = useState(true);
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== 'All') params.set('type', type);
    if (upcoming) params.set('upcoming', 'true');
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    fetch(`/api/proxy/events?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        setEvents(res.data || []);
        setTotal(Number(res.total ?? 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, upcoming, page]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <div className="flex items-start justify-between mb-8">
        {' '}
        <div>
          {' '}
          <h1 className="text-3xl font-bold">Events</h1>{' '}
          <p className="text-muted-foreground mt-1">
            Workshops, webinars, and conferences for the machining community.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {' '}
        <div className="flex gap-2 flex-wrap">
          {' '}
          {eventTypes.map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}
            >
              {' '}
              {t}{' '}
            </button>
          ))}{' '}
        </div>{' '}
        <label className="flex items-center gap-2 text-sm ml-auto">
          {' '}
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => {
              setUpcoming(e.target.checked);
              setPage(1);
            }}
            className="rounded"
          />{' '}
          Upcoming only{' '}
        </label>{' '}
      </div>{' '}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {' '}
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}{' '}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          {' '}
          <Calendar className="mx-auto h-12 w-12 mb-3 opacity-50" /> <p>No events found.</p>{' '}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {' '}
          {events.map((event) => {
            const isFull = event.maxAttendees ? event.registeredCount >= event.maxAttendees : false;
            const loc = event.location as { venue?: string; city?: string; state?: string } | null;
            return (
              <Link key={event.id} href={`/events/${event.slug}`}>
                {' '}
                <Card className="group overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all h-full flex flex-col">
                  {' '}
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/30 relative overflow-hidden">
                    {' '}
                    {event.thumbnailUrl ? (
                      <img
                        src={event.thumbnailUrl}
                        alt={event.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {' '}
                        <Calendar className="h-12 w-12 text-primary/40" />{' '}
                      </div>
                    )}{' '}
                    <div className="absolute top-3 left-3 flex gap-1">
                      {' '}
                      <Badge className="capitalize">{event.eventType}</Badge>{' '}
                      {event.isVirtual && <Badge variant="secondary">Virtual</Badge>}{' '}
                      {isFull && <Badge variant="destructive">Full</Badge>}{' '}
                    </div>{' '}
                  </div>{' '}
                  <CardHeader className="flex-1">
                    {' '}
                    <CardTitle className="text-lg">{event.title}</CardTitle>{' '}
                    <div className="space-y-1.5 mt-2">
                      {' '}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {' '}
                        <Calendar className="h-4 w-4 shrink-0" />{' '}
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        {event.endDate &&
                          ` — ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}{' '}
                      </div>{' '}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {' '}
                        <MapPin className="h-4 w-4 shrink-0" />{' '}
                        {event.isVirtual
                          ? 'Online'
                          : loc?.city
                            ? `${loc.city}${loc.state ? `, ${loc.state}` : ''}`
                            : 'TBD'}{' '}
                      </div>{' '}
                      {event.maxAttendees && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {' '}
                          <Users className="h-4 w-4 shrink-0" /> {event.registeredCount}/
                          {event.maxAttendees} registered{' '}
                        </div>
                      )}{' '}
                      {event.price && event.price > 0 && (
                        <p className="font-semibold text-primary">
                          {' '}
                          ${(event.price / 100).toFixed(2)}{' '}
                        </p>
                      )}{' '}
                    </div>{' '}
                  </CardHeader>{' '}
                  <CardFooter>
                    {' '}
                    <Button className="w-full" variant={isFull ? 'secondary' : 'default'} asChild>
                      {' '}
                      <span>{isFull ? 'Full' : 'Register'}</span>{' '}
                    </Button>{' '}
                  </CardFooter>{' '}
                </Card>{' '}
              </Link>
            );
          })}{' '}
        </div>
      )}{' '}
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
      )}{' '}
    </div>
  );
}
