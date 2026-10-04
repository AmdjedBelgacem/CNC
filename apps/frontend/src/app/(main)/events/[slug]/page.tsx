'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
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
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchEvent = () => {
    fetch(`/api/proxy/events/${slug}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchEvent();
  }, [slug]);
  const handleRegister = async () => {
    if (!event) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setRegistering(true);
    try {
      if (event.userRegistration) {
        await fetch(`/api/proxy/events/${event.id}/register`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } else {
        await fetch(`/api/proxy/events/${event.id}/register`, {
          method: 'POST',
          credentials: 'include',
        });
      }
      fetchEvent();
    } catch {
    } finally {
      setRegistering(false);
    }
  };
  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        {' '}
        <Skeleton className="h-64 rounded-xl mb-8" /> <Skeleton className="h-8 w-2/3 mb-4" />{' '}
        <Skeleton className="h-4 w-1/3 mb-2" /> <Skeleton className="h-24 w-full" />{' '}
      </div>
    );
  }
  if (!event) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
        {' '}
        Event not found.{' '}
      </div>
    );
  }
  const loc = event.location as Record<string, string> | null;
  const isRegistered = !!event.userRegistration;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      {' '}
      <Button variant="ghost" size="sm" className="mb-6" asChild>
        {' '}
        <Link href="/events">
          <ArrowLeft className="flip-rtl size-4 me-1" /> All Events
        </Link>{' '}
      </Button>{' '}
      <div className="grid gap-8 lg:grid-cols-3">
        {' '}
        <div className="lg:col-span-2 space-y-6">
          {' '}
          <div className="aspect-video rounded-xl bg-muted blueprint-grid overflow-hidden">
            {' '}
            <img
              src={getImageSrc(event.thumbnailUrl, 'event')}
              alt={event.title}
              className="h-full w-full object-cover"
            />{' '}
          </div>{' '}
          <div>
            {' '}
            <div className="flex items-center gap-2 mb-2">
              {' '}
              <Badge className="capitalize">{event.eventType}</Badge>{' '}
              {event.isVirtual && <Badge variant="secondary">Virtual</Badge>}{' '}
              {event.isFull && <Badge variant="destructive">Full</Badge>}{' '}
              {isRegistered && (
                <Badge variant="outline" className="text-green-600 border-green-400">
                  <CheckCircle className="size-3.5 me-1" />
                  Registered
                </Badge>
              )}{' '}
            </div>{' '}
            <h1 className="text-3xl font-bold">{event.title}</h1>{' '}
          </div>{' '}
          {event.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {' '}
              <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div className="space-y-4">
          {' '}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            {' '}
            <h2 className="font-semibold">Event Details</h2>{' '}
            <div className="space-y-3 text-sm">
              {' '}
              <div className="flex items-start gap-3">
                {' '}
                <Calendar className="size-4 text-primary mt-0.5 shrink-0" />{' '}
                <div>
                  {' '}
                  <p className="font-medium">{formatDate(event.startDate)}</p>{' '}
                  <p className="text-muted-foreground">
                    {' '}
                    {formatTime(event.startDate)}{' '}
                    {event.endDate &&
                      ` — ${formatDate(event.endDate) !== formatDate(event.startDate) ? formatDate(event.endDate) : formatTime(event.endDate)}`}{' '}
                  </p>{' '}
                </div>{' '}
              </div>{' '}
              <div className="flex items-start gap-3">
                {' '}
                <MapPin className="size-4 text-primary mt-0.5 shrink-0" />{' '}
                <div>
                  {' '}
                  <p className="font-medium">
                    {' '}
                    {event.isVirtual ? 'Online' : loc?.venue || loc?.city || 'TBD'}{' '}
                  </p>{' '}
                  {loc?.address && <p className="text-muted-foreground">{loc.address}</p>}{' '}
                  {loc?.city && (
                    <p className="text-muted-foreground">
                      {loc.city}
                      {loc?.state ? `, ${loc.state}` : ''}
                    </p>
                  )}{' '}
                </div>{' '}
              </div>{' '}
              {event.maxAttendees && (
                <div className="flex items-center gap-3">
                  {' '}
                  <Users className="size-4 text-primary shrink-0" />{' '}
                  <div className="flex-1">
                    {' '}
                    <div className="flex justify-between text-sm mb-1">
                      {' '}
                      <span className="font-medium">{event.registeredCount} registered</span>{' '}
                      <span className="text-muted-foreground">of {event.maxAttendees}</span>{' '}
                    </div>{' '}
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      {' '}
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, (event.registeredCount / event.maxAttendees) * 100)}%`,
                        }}
                      />{' '}
                    </div>{' '}
                  </div>{' '}
                </div>
              )}{' '}
              {event.price && event.price > 0 && (
                <div className="flex items-center gap-3">
                  {' '}
                  <DollarSign className="size-4 text-primary shrink-0" />{' '}
                  <span className="font-medium">${(event.price / 100).toFixed(2)}</span>{' '}
                </div>
              )}{' '}
              {event.isVirtual && (
                <div className="flex items-center gap-3">
                  {' '}
                  <Monitor className="size-4 text-primary shrink-0" />{' '}
                  <span className="text-muted-foreground">
                    Link provided after registration
                  </span>{' '}
                </div>
              )}{' '}
            </div>{' '}
          </div>{' '}
          <Button
            className="w-full"
            size="lg"
            disabled={(!isRegistered && event.isFull) || registering}
            variant={isRegistered ? 'outline' : 'default'}
            onClick={handleRegister}
          >
            {' '}
            {registering ? (
              <Loader2 className="size-4 animate-spin me-2" />
            ) : isRegistered ? (
              <>
                <XCircle className="size-4 me-2" /> Cancel Registration
              </>
            ) : event.isFull ? (
              'Event Full'
            ) : (
              <>
                <CheckCircle className="size-4 me-2" /> Register Now
              </>
            )}{' '}
          </Button>{' '}
          {isRegistered && event.isVirtual && (
            <div className="rounded-lg border bg-primary/5 p-4 text-sm">
              {' '}
              <p className="font-medium mb-1">Virtual Access</p>{' '}
              <p className="text-muted-foreground">
                Login details will be emailed before the event.
              </p>{' '}
            </div>
          )}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
