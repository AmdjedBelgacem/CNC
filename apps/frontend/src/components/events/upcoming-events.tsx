'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
interface EventItem {
  id: string;
  title: string;
  slug: string;
  eventType: string;
  startDate: string;
  isVirtual: boolean;
  location: { city?: string; state?: string } | null;
  registeredCount: number;
  maxAttendees: number | null;
}
export function UpcomingEvents() {
  const te = useTranslations('events');
  const tc = useTranslations('common');
  const tu = useTranslations('ui.events');
  const locale = useLocale();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/proxy/events/upcoming?limit=3', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (!loading && events.length === 0) return null;
  return (
    <section className="border-t py-24 bg-secondary/20">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        <div className="flex items-center justify-between mb-12">
          {' '}
          <div>
            {' '}
            <h2 className="text-3xl font-bold">{tu('upcomingEventsTitle')}</h2>{' '}
            <p className="text-muted-foreground mt-1">{tu('upcomingEventsHint')}</p>{' '}
          </div>{' '}
          <Button variant="ghost" asChild>
            {' '}
            <Link href="/events">
              {tc('viewAll')} <ArrowRight className="flip-rtl ms-2 size-4" />
            </Link>{' '}
          </Button>{' '}
        </div>{' '}
        <div className="grid gap-6 md:grid-cols-3">
          {' '}
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)
            : events.map((event) => {
                const loc = event.location as { city?: string; state?: string } | null;
                return (
                  <Link key={event.id} href={`/events/${event.slug}`}>
                    {' '}
                    <div className="rounded-xl border bg-card p-6 space-y-3 hover:border-primary/50 hover:shadow-lg transition-all group">
                      {' '}
                      <Badge className="capitalize w-fit">{event.eventType}</Badge>{' '}
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {event.title}
                      </h3>{' '}
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        {' '}
                        <div className="flex items-center gap-2">
                          {' '}
                          <Calendar className="size-4 shrink-0" />{' '}
                          {formatDate(event.startDate, locale, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                        </div>{' '}
                        <div className="flex items-center gap-2">
                          {' '}
                          <MapPin className="size-4 shrink-0" />{' '}
                          {event.isVirtual
                            ? te('online')
                            : loc?.city
                              ? `${loc.city}${loc.state ? `, ${loc.state}` : ''}`
                              : tu('tbd')}{' '}
                        </div>{' '}
                      </div>{' '}
                      {event.maxAttendees && (
                        <p className="text-xs text-muted-foreground">
                          {' '}
                          {tu('registeredCount', {
                            count: event.registeredCount,
                            total: event.maxAttendees,
                          })}{' '}
                        </p>
                      )}{' '}
                    </div>{' '}
                  </Link>
                );
              })}{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
