'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Clock, Loader2, Radio, Users, Video } from 'lucide-react';
import {
  joinLiveSession,
  useCourseLiveSessions,
  type LearnerLiveSession,
} from '@/hooks/use-live-sessions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * "Upcoming live sessions" on the course page.
 *
 * Every session arrives with a server-computed `joinState`, so the disabled
 * states here (opens soon / ended / enroll to join) mirror the backend join
 * gate exactly. The Meet URL is fetched only when the learner actually clicks
 * Join — the list response never carries it.
 */
export function LiveSessionsSection({ courseId }: { courseId: string }) {
  const t = useTranslations('courses.liveSessions');
  const { sessions, isLoading } = useCourseLiveSessions(courseId);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  if (isLoading || sessions.length === 0) return null;

  const upcoming = sessions.filter((s) => s.status === 'scheduled' || s.status === 'live');
  const past = sessions.filter((s) => s.status === 'completed');
  if (upcoming.length === 0 && past.length === 0) return null;

  const formatWhen = (session: LearnerLiveSession) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: session.timezone || undefined,
      }).format(new Date(session.startsAt));
    } catch {
      return new Date(session.startsAt).toLocaleString();
    }
  };

  const formatDuration = (session: LearnerLiveSession) => {
    const minutes = Math.max(0, Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60_000));
    if (minutes < 60) return t('minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? t('hours', { count: hours }) : t('hoursMinutes', { hours, minutes: rest });
  };

  const join = async (session: LearnerLiveSession) => {
    setJoiningId(session.id);
    try {
      const result = await joinLiveSession(session.id);
      window.open(result.meetUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        type: 'err',
        title: t('joinFailed', { default: 'Could not open the session' }),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setJoiningId(null);
    }
  };

  const joinLabel = (session: LearnerLiveSession) => {
    switch (session.joinState) {
      case 'joinable':
        return t('joinNow', { default: 'Join live' });
      case 'not_started':
        return t('opensSoon', { default: 'Opens 15 minutes before' });
      case 'not_enrolled':
        return t('enrollToJoin', { default: 'Enroll to join' });
      case 'ended':
        return t('ended', { default: 'Session ended' });
      case 'cancelled':
        return t('cancelled', { default: 'Cancelled' });
    }
  };

  const renderCard = (session: LearnerLiveSession) => {
    const isLive = session.status === 'live';
    const canJoin = session.joinState === 'joinable';
    return (
      <Card key={session.id} className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                isLive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
              )}
            >
              {isLive ? <Radio className="size-5" /> : <Video className="size-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-base font-semibold text-foreground">{session.title}</p>
                {isLive ? (
                  <Badge variant="soft" className="border-destructive/20 bg-destructive/10 text-destructive">
                    {t('liveBadge', { default: 'Live' })}
                  </Badge>
                ) : null}
                {session.status === 'cancelled' ? (
                  <Badge variant="soft" className="text-muted-foreground">
                    {t('cancelled', { default: 'Cancelled' })}
                  </Badge>
                ) : null}
              </div>
              {session.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{session.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  {formatWhen(session)}
                  <span className="text-border-strong">·</span>
                  <span dir="ltr">{session.timezone}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {formatDuration(session)}
                </span>
                {session.capacity != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {t('capacity', { count: session.capacity })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Button
            onClick={() => void join(session)}
            disabled={!canJoin || joiningId === session.id || !session.hasMeetUrl}
            variant={canJoin ? 'default' : 'outline'}
            className="shrink-0"
          >
            {joiningId === session.id ? <Loader2 className="size-4 animate-spin" /> : null}
            {joinLabel(session)}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <section id="live-sessions" className="scroll-mt-24 border-y border-border bg-surface-sunken/35">
      <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              {t('eyebrow', { default: 'Live on Google Meet' })}
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t('title', { default: 'Upcoming live sessions' })}
            </h2>
          </div>
        </div>
        {upcoming.length > 0 ? (
          <div className="mt-8 space-y-3">
            {upcoming.map(renderCard)}
          </div>
        ) : null}
        {past.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted-foreground transition hover:text-foreground">
              {t('pastSessions', { count: past.length })}
            </summary>
            <div className="mt-3 space-y-3 opacity-75">
              {past.map(renderCard)}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
