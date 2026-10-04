'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { PostCard } from '@/components/feed/post-card';
import { useVotePost } from '@/hooks/use-feed';
import {
  useFollowSuggestions,
  useProfileConnections,
  useProfilePosts,
} from '@/hooks/use-profile';
import { FollowButton } from '@/components/profile/follow-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth-store';
import { initialsOf } from '@/lib/format';
import Link from 'next/link';
import type { Profile } from '@/lib/api/types';

/** The member's public posts, with working like/comment affordances. */
export function ProfileActivity({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, isError, refetch } = useProfilePosts(profile.id, 1);
  const votePost = useVotePost();
  // Which comment a notification deep-linked to, so the thread can highlight it.
  const [openPost] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('loadFailed')}
        onRetry={() => void refetch()}
        className="rounded-lg border border-border bg-card"
      />
    );
  }

  const posts = data?.data ?? [];

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold text-foreground">{t('noPosts')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('noPostsHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onVote={(postId, value) => votePost.mutate({ postId, value })}
          focusCommentId={openPost}
        />
      ))}
      {(data?.total ?? 0) > posts.length && (
        <p className="pt-2 text-center font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
          {t('showingLatest', { count: posts.length, total: data?.total ?? 0 })}
        </p>
      )}
    </div>
  );
}

/** Followers / following browser. */
export function ProfileConnectionsDialog({
  profile,
  kind,
  onOpenChange,
}: {
  profile: Profile;
  kind: 'followers' | 'following' | null;
  onOpenChange: (kind: 'followers' | 'following' | null) => void;
}) {
  const t = useTranslations('profile');
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { connections, data, isLoading, isError, refetch, markChanged } = useProfileConnections(
    profile.id,
    kind,
  );
  const total = data?.total ?? 0;

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent size="md" className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {kind === 'following' ? t('following') : t('followers')}
            {total ? <span className="ms-2 font-mono text-2xs text-muted-foreground">{total}</span> : null}
          </DialogTitle>
          <DialogDescription>{t('connectionsDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="overflow-y-auto">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}
          {isError && <ErrorState title={t('loadFailed')} onRetry={() => void refetch()} compact />}
          {!isLoading && !isError && connections.length === 0 && (
            <EmptyState
              compact
              icon={Users}
              title={kind === 'following' ? t('notFollowing') : t('noFollowers')}
            />
          )}
          {!isLoading && !isError && connections.length > 0 && (
            <ul className="space-y-1">
              {connections.map((person) => {
                const isSelf = person.id === currentUserId;
                return (
                  <li key={person.id}>
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted">
                      <Link
                        href={person.username ? `/u/${person.username}` : `/profile/${person.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <Avatar className="size-10">
                          <AvatarImage src={person.avatarUrl || undefined} alt="" />
                          <AvatarFallback>{initialsOf(person.name, person.username)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {person.name || person.username || t('unnamed')}
                          </span>
                          {person.headline && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {person.headline}
                            </span>
                          )}
                        </span>
                      </Link>
                      {/* You can never follow yourself, so your own row is
                      labelled instead of carrying a button. */}
                      {isSelf ? (
                        <Badge variant="soft-muted">{t('you')}</Badge>
                      ) : (
                        <FollowButton
                          targetId={person.id}
                          state={{ following: person.isFollowing }}
                          onChanged={markChanged}
                          size="xs"
                          variant={person.isFollowing ? 'ghost' : 'outline'}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "People to follow" — members of the tenant the viewer does not follow yet,
 * ranked by how many accounts the two of them already follow in common.
 */
export function ProfileSuggestions({ viewerId }: { viewerId: string | undefined }) {
  const t = useTranslations('profile');
  const { suggestions, markChanged, isLoading } = useFollowSuggestions(!!viewerId);

  if (!viewerId || (!isLoading && suggestions.length === 0)) return null;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-primary">
        {t('peopleToFollow')}
      </p>
      <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
        {t('peopleToFollowHint')}
      </h2>

      {isLoading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs"
            >
              <Link
                href={person.username ? `/u/${person.username}` : `/profile/${person.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar className="size-10">
                  <AvatarImage src={person.avatarUrl || undefined} alt="" />
                  <AvatarFallback>{initialsOf(person.name, person.username)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {person.name || person.username || t('unnamed')}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.headline || t('followersCount', { count: person.followerCount })}
                  </span>
                  {person.mutualCount > 0 && (
                    <span className="mt-0.5 block font-mono text-2xs uppercase tracking-[0.1em] text-primary">
                      {t('inCommon', { count: person.mutualCount })}
                    </span>
                  )}
                </span>
              </Link>
              <FollowButton
                targetId={person.id}
                state={{ following: person.isFollowing }}
                onChanged={markChanged}
                size="xs"
                variant={person.isFollowing ? 'ghost' : 'outline'}
                showLabel={false}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Small stat strip reused in the tab bar header. */
export function ProfileTabMeta({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground tabular-nums">{profile.stats.posts}</span>{' '}
        {t('statPosts')}
      </span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {profile.learning.enrollments}
        </span>{' '}
        {t('statEnrolled')}
      </span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {profile.portfolioItems.length}
        </span>{' '}
        {t('statProjects')}
      </span>
      <Button variant="link" size="xs" asChild>
        <a href="#activity">{t('jumpToActivity')}</a>
      </Button>
    </div>
  );
}
