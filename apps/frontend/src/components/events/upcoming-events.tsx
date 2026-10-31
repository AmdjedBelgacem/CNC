'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
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
    <section className="border-t border-border/70 bg-surface-sunken/40 py-20 md:py-28">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-4">
          {' '}
          <div>
            {' '}
            <h2 className="text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl">{tu('upcomingEventsTitle')}</h2>{' '}
            <p className="mt-2 max-w-prose text-muted-foreground">{tu('upcomingEventsHint')}</p>{' '}
          </div>{' '}
          <Button variant="ghost" asChild>
            {' '}
            <Link href="/events">
              {tc('viewAll')} <ArrowRight className="flip-rtl ms-2 size-4" />
            </Link>{' '}
          </Button>{' '}
        </Reveal>{' '}
        <Stagger inViewOnly className="grid gap-6 md:grid-cols-3">
          {' '}
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)
            : events.map((event, i) => {
                const loc = event.location as { city?: string; state?: string } | null;
                return (
                  <StaggerItem key={event.id} index={i}>
                  <HoverLift className="h-full">
                  <Link href={`/events/${event.slug}`} className="block h-full">
                    {' '}
                    <div className="group h-full space-y-3 rounded-2xl border border-border/70 bg-card p-6 shadow-xs transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-lg">
                      {' '}
                      <Badge variant="soft-muted" className="w-fit capitalize">{event.eventType}</Badge>{' '}
                      <h3 className="font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
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
                  </HoverLift>
                  </StaggerItem>
                );
              })}{' '}
        </Stagger>{' '}
      </div>{' '}
    </section>
  );
}
