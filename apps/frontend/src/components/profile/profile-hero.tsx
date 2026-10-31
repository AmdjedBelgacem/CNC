'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Award,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Globe,
  Link2,
  MapPin,
  Pencil,
  Share2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { FollowButton } from '@/components/profile/follow-button';
import { formatDate, initialsOf } from '@/lib/format';
import { getImageSrc } from '@/lib/images';
import type { Profile } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, AnimatedNumber, m } from '@/components/ui/motion';
import { RollingNumber } from '@/components/feed/feed-motion';
import { spring } from '@/lib/motion';

/** Shared stat tile used by the hero strip and the at-a-glance rail. */
export function ProfileStat({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: 'primary' | 'accent' | 'muted';
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 text-start shadow-xs transition-[border-color,box-shadow] duration-300',
        onClick && 'hover:border-border hover:shadow-md motion-reduce:transition-none',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          tone === 'accent'
            ? 'bg-accent/10 text-accent'
            : tone === 'muted'
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-medium leading-none tracking-[-0.015em] text-foreground tabular-nums">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </span>
        <span className="mt-1.5 block truncate text-xs text-muted-foreground">
          {label}
        </span>
      </span>
    </Wrapper>
  );
}

export function ProfileHero({
  profile,
  onOpenConnections,
}: {
  profile: Profile;
  onOpenConnections?: (kind: 'followers' | 'following') => void;
}) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  // The profile arrives as a server-rendered prop, so follow state is local
  // here rather than in a query cache nothing reads.
  const [following, setFollowing] = useState(profile.isFollowing);
  const [followerCount, setFollowerCount] = useState(profile.stats.followers);

  const displayName = profile.name?.trim() || profile.username || t('unnamed');
  // Built on demand: this component is server-rendered, so `window` is not
  // available during render.
  const profileUrl = () =>
    profile.username
      ? `${window.location.origin}/u/${profile.username}`
      : window.location.href;

  const copyHandle = async () => {
    if (!profile.username) return;
    try {
      await navigator.clipboard.writeText(`@${profile.username}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ type: 'err', title: t('copyFailed') });
    }
  };

  const share = async () => {
    const shareData = { title: displayName, url: profileUrl() };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(profileUrl());
      toast({ type: 'ok', title: t('linkCopied') });
    } catch {
      /* dismissed */
    }
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-border/70 bg-background">
      <div className="ambient-wash absolute inset-0 -z-10" aria-hidden />

      <div className="px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-container-max pt-4 md:pt-6">
        {/* Cover */}
        <div className="relative h-36 overflow-hidden rounded-2xl border border-border/60 bg-muted sm:h-44 md:h-56">
          {profile.coverImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageSrc(profile.coverImageUrl, 'user')}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-muted to-accent/15" />
              <div className="blueprint-grid absolute inset-0 opacity-60" aria-hidden />
              <div className="absolute -end-16 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" aria-hidden />
              <div className="absolute -bottom-24 start-1/4 size-64 rounded-full bg-accent/15 blur-3xl" aria-hidden />
            </>
          )}
        </div>

        <div className="pb-10 md:pb-12">
          <div className="-mt-12 flex flex-col gap-6 px-1 md:-mt-14 md:flex-row md:items-end md:justify-between md:px-4">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
              <m.div
                initial={false}
                whileHover={{ scale: 1.03, rotate: -1 }}
                transition={spring.smooth}
                className="shrink-0 self-start rounded-full"
              >
                <Avatar className="size-28 rounded-full shadow-lg ring-4 ring-background sm:size-32 md:size-36">
                  <AvatarImage src={profile.avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-full bg-primary/10 font-display text-3xl font-medium text-primary">
                    {initialsOf(profile.name, profile.username)}
                  </AvatarFallback>
                </Avatar>
              </m.div>

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-balance font-display text-3xl font-medium leading-tight tracking-[-0.022em] text-foreground sm:text-4xl lg:text-5xl">
                    {displayName}
                  </h1>
                  {profile.isVerified && (
                    <BadgeCheck
                      className="size-6 shrink-0 text-primary"
                      aria-label={t('verified')}
                    />
                  )}
                  {profile.role && <Badge variant="accent">{t(`roles.${profile.role}`)}</Badge>}
                  {profile.isPrivate && <Badge variant="warning">{t('privateProfile')}</Badge>}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  {profile.username && (
                    <button
                      type="button"
                      onClick={() => void copyHandle()}
                      className="group inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-foreground"
                    >
                      @{profile.username}
                      <AnimatePresence mode="wait" initial={false}>
                        {copied ? (
                          <m.span
                            key="copied"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="inline-flex"
                          >
                            <Check className="size-3.5 text-success" />
                          </m.span>
                        ) : (
                          <m.span key="copy" exit={{ opacity: 0 }} className="inline-flex">
                            <Copy className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                          </m.span>
                        )}
                      </AnimatePresence>
                    </button>
                  )}
                  {profile.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {profile.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    <bdi>{t('memberSince', { date: formatDate(profile.createdAt, locale) })}</bdi>
                  </span>
                </div>

                {profile.headline && (
                  <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-foreground/80 sm:text-lg">
                    {profile.headline}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              {profile.isSelf ? (
                <Button variant="outline" asChild>
                  <Link href="/settings/profile">
                    <Pencil className="size-4" />
                    {t('editProfile')}
                  </Link>
                </Button>
              ) : (
                profile.canFollow && (
                  <FollowButton
                    targetId={profile.id}
                    state={{ following }}
                    onChanged={(_targetId, nowFollowing) => {
                      setFollowing(nowFollowing);
                      setFollowerCount((count) => Math.max(0, count + (nowFollowing ? 1 : -1)));
                    }}
                  />
                )
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => void share()}
                aria-label={t('share')}
              >
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Connections strip */}
          {!profile.isPrivate && (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/70 px-1 pt-5 text-sm text-muted-foreground md:px-4">
              <button
                type="button"
                onClick={() => onOpenConnections?.('followers')}
                className="inline-flex items-baseline gap-1.5 rounded-md transition-colors hover:text-foreground"
              >
                <RollingNumber
                  value={followerCount}
                  className="font-display text-lg font-medium text-foreground"
                />{' '}
                {t('followers')}
              </button>
              <button
                type="button"
                onClick={() => onOpenConnections?.('following')}
                className="inline-flex items-baseline gap-1.5 rounded-md transition-colors hover:text-foreground"
              >
                <span className="font-display text-lg font-medium text-foreground tabular-nums">
                  {profile.stats.following}
                </span>{' '}
                {t('following')}
              </button>
              <span className="inline-flex items-center gap-1.5">
                <Award className="size-3.5" />
                <span className="font-display text-lg font-medium text-foreground tabular-nums">
                  {profile.learning.certificates}
                </span>{' '}
                {t('certificates')}
              </span>
              {profile.company && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  {profile.company}
                </span>
              )}
              {profile.links.website && (
                <a
                  href={profile.links.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-primary transition-colors hover:underline"
                >
                  <Globe className="size-3.5" />
                  {t('website')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * "At a glance" rail. Deliberately identity-only: the numeric stats live in the
 * Overview tab, so repeating them here would just be noise.
 */
export function ProfileGlance({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const locale = useLocale();

  // Role is deliberately absent: it is already an explicit badge next to the
  // name in the hero, and repeating it here was pure duplication.
  const facts: { label: string; value: string }[] = [
    { label: t('memberSinceLabel'), value: formatDate(profile.createdAt, locale) },
    ...(profile.location ? [{ label: t('locationLabel'), value: profile.location }] : []),
    ...(profile.company ? [{ label: t('companyLabel'), value: profile.company }] : []),
    ...(profile.language
      ? [{ label: t('language'), value: profile.language.toUpperCase() }]
      : []),
    ...(profile.timezone ? [{ label: t('timezone'), value: profile.timezone }] : []),
    {
      label: t('lastSeen'),
      value: profile.lastLoginAt ? formatDate(profile.lastLoginAt, locale) : t('never'),
    },
    { label: t('updatedLabel'), value: formatDate(profile.updatedAt, locale) },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <h2 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
        {t('atAGlance')}
      </h2>
      <dl className="mt-4 divide-y divide-border/60">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            {/* `bdi` isolates the value: a date like 2026/09/21 is otherwise
                split by the bidi algorithm in the Arabic layout. */}
            <dd className="text-end text-sm tabular-nums text-foreground">
              <bdi>{fact.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      {profile.skills.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('skills')}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <Badge key={skill} variant="soft">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(profile.links.github || profile.links.linkedin) && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {profile.links.github && (
            <Button variant="outline" size="sm" asChild>
              <a href={profile.links.github} target="_blank" rel="noreferrer noopener">
                <Link2 className="size-3.5" />
                GitHub
              </a>
            </Button>
          )}
          {profile.links.linkedin && (
            <Button variant="outline" size="sm" asChild>
              <a href={profile.links.linkedin} target="_blank" rel="noreferrer noopener">
                <Link2 className="size-3.5" />
                LinkedIn
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
