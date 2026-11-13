'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { formatDate as formatDateInLocale } from '@/lib/format';
import { formatMoney } from '@/lib/api/normalize';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EventDetailSkeleton } from '@/components/skeletons/public-route-skeletons';
import { useAuthStore } from '@/stores/auth-store';
import { useBuyAndCheckout, usePaymentConfig } from '@/hooks/use-payments';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Monitor,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { getImageSrc } from '@/lib/images';
import { toast } from '@/components/ui/toast';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { ease, spring, transition } from '@/lib/motion';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';
interface EventDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventType: string;
  startDate: string;
  endDate: string | null;
  location: { venue?: string; address?: string; city?: string; state?: string } | null;
  isVirtual: boolean;
  maxAttendees: number | null;
  price: number | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  registeredCount: number;
  isFull: boolean;
  userRegistration: { id: string; status: string; registeredAt: string } | null;
}
export default function EventDetailPage() {
  const t = useTranslations('events');
  const td = useTranslations('pages.eventDetail');
  const locale = useLocale();
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { buy } = useBuyAndCheckout();
  const { data: payments } = usePaymentConfig(isAuthenticated);
  const fetchEvent = () => {
    api.get<EventDetail>(`/events/${slug}`, { locale })
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchEvent();
  }, [slug]);
  const isPaid = (event?.price ?? 0) > 0;
  const handleRegister = async () => {
    if (!event) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const wasRegistered = !!event.userRegistration;
    // A priced event is a ticket: it goes through the same payment gateway as a course or product,
    // because the server refuses to register anyone for it any other way.
    if (!wasRegistered && (event.price ?? 0) > 0) {
      if (!payments?.data?.enabled) {
        toast({ type: 'err', title: t('purchaseUnavailable') });
        return;
      }
      setRegistering(true);
      try {
        await buy([{ itemType: 'event_ticket', refId: event.id, quantity: 1 }]);
      } catch (error) {
        toast({ type: 'err', title: (error as Error)?.message ?? t('registerFailed') });
        setRegistering(false);
      }
      return;
    }
    setRegistering(true);
    try {
      const res = await fetchWithRefresh(`/api/proxy/events/${event.id}/register`, {
        method: wasRegistered ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(t('registerFailed'));
      fetchEvent();
      toast({
        type: 'ok',
        title: wasRegistered ? t('registrationCancelled') : t('registeredOk'),
      });
    } catch (error) {
      toast({
        type: 'err',
        title: t('registerFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRegistering(false);
    }
  };
  if (loading) {
    return <EventDetailSkeleton />;
  }
  if (!event) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="font-display text-2xl font-medium tracking-[-0.015em] text-foreground">{td('notFound')}</p>
      </div>
    );
  }
  const loc = event.location as Record<string, string> | null;
  const isRegistered = !!event.userRegistration;
  const formatDate = (d: string) =>
    formatDateInLocale(d, locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  const formatTime = (d: string) =>
    formatDateInLocale(d, locale, { hour: 'numeric', minute: '2-digit' });
  const start = new Date(event.startDate);
  const hasStart = !Number.isNaN(start.getTime());
  const fill = event.maxAttendees
    ? Math.min(100, (event.registeredCount / event.maxAttendees) * 100)
    : 0;
  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
      <Button variant="ghost" size="sm" className="mb-6 -ms-2 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/events">
          <ArrowLeft className="flip-rtl me-1 size-4" /> {t('all')}
        </Link>
      </Button>
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
        <div className="space-y-8 lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageSrc(event.thumbnailUrl, 'event')}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-start gap-5">
            {hasStart && (
              <div
                aria-hidden
                className="hidden w-20 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:flex"
              >
                <span className="w-full bg-primary/10 py-1.5 text-center text-xs font-medium text-primary">
                  {formatDateInLocale(start, locale, { month: 'short' })}
                </span>
                <span className="pt-2 font-display text-4xl font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
                  {formatDateInLocale(start, locale, { day: 'numeric' })}
                </span>
                <span className="pb-2 pt-1 text-xs text-muted-foreground">
                  {formatDateInLocale(start, locale, { weekday: 'short' })}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="soft-muted" className="capitalize">{event.eventType}</Badge>
                {event.isVirtual && <Badge variant="outline">{td('virtual')}</Badge>}
                {event.isFull && (
                  <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                    {td('full')}
                  </Badge>
                )}
                <AnimatePresence initial={false}>
                  {isRegistered && (
                    <m.span
                      key="registered"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                      exit={{ opacity: 0, scale: 0.9, transition: transition.leave }}
                      className="inline-flex"
                    >
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                        <CheckCircle className="me-1 size-3.5" />
                        {t('registered')}
                      </Badge>
                    </m.span>
                  )}
                </AnimatePresence>
              </div>
              <h1 className="text-balance font-display text-3xl font-medium leading-tight tracking-[-0.022em] text-foreground md:text-4xl">
                {event.title}
              </h1>
            </div>
          </div>
          {event.description && (
            <Reveal className="max-w-prose border-t border-border/60 pt-8">
              <p className="whitespace-pre-line text-[15px] leading-[1.75] text-muted-foreground">{event.description}</p>
            </Reveal>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">{td('details')}</h2>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Calendar className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-foreground">{formatDate(event.startDate)}</p>
                  <p className="text-muted-foreground">
                    {formatTime(event.startDate)}
                    {event.endDate &&
                      ` — ${formatDate(event.endDate) !== formatDate(event.startDate) ? formatDate(event.endDate) : formatTime(event.endDate)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {event.isVirtual ? t('online') : loc?.venue || loc?.city || td('tbd')}
                  </p>
                  {loc?.address && <p className="text-muted-foreground">{loc.address}</p>}
                  {loc?.city && (
                    <p className="text-muted-foreground">
                      {loc.city}
                      {loc?.state ? `, ${loc.state}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {event.maxAttendees && (
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Users className="size-4" />
                  </span>
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium tabular-nums text-foreground">
                        {td('registeredCount', { count: event.registeredCount })}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {td('ofCapacity', { max: event.maxAttendees })}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <m.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${fill}%` }}
                        transition={{ duration: 0.9, ease: ease.emerge, delay: 0.15 }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {event.price && event.price > 0 && (
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <DollarSign className="size-4" />
                  </span>
                  <span className="font-display text-xl font-medium tabular-nums text-foreground">
                    {formatMoney(event.price, 'SAR', locale)}
                  </span>
                </div>
              )}
              {event.isVirtual && (
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Monitor className="size-4" />
                  </span>
                  <span className="text-muted-foreground">{td('linkAfterRegistration')}</span>
                </div>
              )}
            </div>
            <div className="border-t border-border/60 pt-5">
              <Button
                className="w-full"
                size="lg"
                disabled={(!isRegistered && event.isFull) || registering}
                variant={isRegistered ? 'outline' : 'default'}
                onClick={handleRegister}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={registering ? 'busy' : isRegistered ? 'cancel' : event.isFull ? 'full' : isPaid ? 'buy' : 'register'}
                    className="inline-flex items-center"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0, transition: transition.enter }}
                    exit={{ opacity: 0, y: -4, transition: transition.leave }}
                  >
                    {registering ? (
                      <Loader2 className="me-2 size-4 animate-spin" />
                    ) : isRegistered ? (
                      <>
                        <XCircle className="me-2 size-4" /> {td('cancelRegistration')}
                      </>
                    ) : event.isFull ? (
                      td('eventFull')
                    ) : (
                      <>
                        <CheckCircle className="me-2 size-4" /> {isPaid ? td('buyTicket') : td('registerNow')}
                      </>
                    )}
                  </m.span>
                </AnimatePresence>
              </Button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {isRegistered && event.isVirtual && (
              <m.div
                key="virtual-access"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', transition: spring.layout }}
                exit={{ opacity: 0, height: 0, transition: transition.leave }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm">
                  <p className="mb-1 font-medium text-foreground">{td('virtualAccess')}</p>
                  <p className="text-muted-foreground">{td('virtualAccessHint')}</p>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
