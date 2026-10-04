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
        'flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-start shadow-xs transition-colors',
        onClick && 'hover:border-border-strong motion-reduce:transition-none',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
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
        <span className="block font-display text-lg font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        <span className="mt-1 block truncate font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
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
    <section className="relative isolate overflow-hidden border-b border-border bg-foreground text-background">
      <div className="blueprint-grid-invert absolute inset-0 -z-20" aria-hidden />
      <div className="absolute -end-32 -top-32 -z-10 size-[28rem] rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="absolute -bottom-48 start-1/3 -z-10 size-[24rem] rounded-full bg-accent/10 blur-3xl" aria-hidden />

      <div className="px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-container-max">
        {/* Cover */}
        <div className="relative h-32 overflow-hidden sm:h-40 md:h-48">
          {profile.coverImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageSrc(profile.coverImageUrl, 'user')}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/55 to-foreground/25" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-secondary via-foreground to-foreground" />
              <div className="blueprint-grid-invert absolute inset-0" aria-hidden />
              <div
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/10 to-transparent"
                aria-hidden
              />
            </>
          )}
          <div className="pointer-events-none absolute -inset-2 rounded-3xl border border-primary/40" aria-hidden />
        </div>

        <div className="pb-10 md:pb-14">
          <div className="-mt-14 flex flex-col gap-6 md:-mt-16 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <Avatar className="size-28 shrink-0 rounded-2xl border-4 border-foreground shadow-lg sm:size-32 md:size-36">
                <AvatarImage src={profile.avatarUrl || undefined} alt={displayName} />
                {/* The hero is dark, so the fallback needs a light well to read against it. */}
                <AvatarFallback className="rounded-2xl bg-background text-2xl text-foreground">
                  {initialsOf(profile.name, profile.username)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
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

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-2xs uppercase tracking-[0.14em] text-background/60">
                  {profile.username && (
                    <button
                      type="button"
                      onClick={() => void copyHandle()}
                      className="group inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                    >
                      @{profile.username}
                      {copied ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
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
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-background/80 sm:text-lg">
                    {profile.headline}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              {profile.isSelf ? (
                <Button variant="secondary" asChild>
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
                variant="secondary"
                size="icon"
                onClick={() => void share()}
                aria-label={t('share')}
                className="border border-background/25 bg-background/10 text-background hover:bg-background/20"
              >
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Connections strip */}
          {!profile.isPrivate && (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-background/15 py-4 font-mono text-2xs uppercase tracking-[0.12em] text-background/60">
              <button
                type="button"
                onClick={() => onOpenConnections?.('followers')}
                className="transition-colors hover:text-primary"
              >
                <span className="font-semibold text-background tabular-nums">
                  {followerCount}
                </span>{' '}
                {t('followers')}
              </button>
              <button
                type="button"
                onClick={() => onOpenConnections?.('following')}
                className="transition-colors hover:text-primary"
              >
                <span className="font-semibold text-background tabular-nums">
                  {profile.stats.following}
                </span>{' '}
                {t('following')}
              </button>
              <span className="inline-flex items-center gap-1.5">
                <Award className="size-3.5" />
                <span className="font-semibold text-background tabular-nums">
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
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-foreground">
        {t('atAGlance')}
      </h2>
      <dl className="mt-4 space-y-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-start justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            {/* `bdi` isolates the value: a date like 2026/09/21 is otherwise
                split by the bidi algorithm in the Arabic layout. */}
            <dd className="text-end font-mono text-xs text-foreground">
              <bdi>{fact.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      {profile.skills.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
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
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
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
