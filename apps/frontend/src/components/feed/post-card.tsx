'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PostAiActions } from '@/components/ai/post-ai-actions';
import { CommentThread } from '@/components/feed/comment-thread';

import { useVotePost } from '@/hooks/use-feed';
import { useAuthStore } from '@/stores/auth-store';
import { initialsOf, timeAgo } from '@/lib/format';

import type { FeedAuthor, FeedPost } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export interface PostCardProps {
  post: FeedPost;
  currentUserId?: string;
  onVote?: (postId: string, value: number) => void;
  onDelete?: (postId: string) => void;
  /** Pre-selects a comment from a notification deep link. */
  focusCommentId?: string | null;
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'Owner',
  admin: 'Staff',
  instructor: 'Instructor',
  moderator: 'Mod',
  sponsor: 'Sponsor',
};

/**
 * A post, with the person who wrote it made obvious.
 *
 * The author block used to read `post.author` while the API sent `user`, so every
 * post rendered as "Unknown" and linked to a profile with an empty id. Both the
 * field name and the missing `username` are fixed at the source now; this renders
 * whatever the API actually sends.
 */
export function PostCard({ post, currentUserId, onVote, onDelete, focusCommentId }: PostCardProps) {
  const t = useTranslations('feed');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const viewerId = currentUserId ?? user?.id;

  const [mediaIdx, setMediaIdx] = useState(0);
  const [threadOpen, setThreadOpen] = useState(Boolean(focusCommentId));
  const [collapsed, setCollapsed] = useState(false);

  const media = useMemo(() => (Array.isArray(post.mediaUrls) ? post.mediaUrls.filter(Boolean) : []), [post.mediaUrls]);
  const author: FeedAuthor | null = post.author ?? null;
  const authorName = author?.name || author?.username || t('unknownAuthor');
  const authorHandle = author?.username ? `@${author.username}` : null;
  const profileHref = author?.username ? `/u/${author.username}` : author?.id ? `/profile/${author.id}` : null;
  const roleLabel = author?.role ? ROLE_BADGE[author.role] : undefined;
  const isMine = !!viewerId && post.userId === viewerId;
  const vote = useVotePost();

  const score = post.score ?? 0;
  const myVote = post.myVote ?? 0;

  const cast = (value: number) => {
    if (!isAuthenticated) return;
    // Tapping the arrow you already chose withdraws the vote, like Reddit.
    if (onVote) onVote(post.id, value);
    else vote.mutate({ postId: post.id, value });
  };

  return (
    <article
      id={`post-${post.id}`}
      className="group/post border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-surface-sunken/30"
    >
      <div className="flex gap-3">
        {/* Vote column. Reddit-style: a stacked arrow / score / arrow. */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => cast(myVote === 1 ? 0 : 1)}
            disabled={!isAuthenticated || isMine}
            aria-label={t('upvote')}
            aria-pressed={myVote === 1}
            title={isMine ? t('cannotVoteOwn') : t('upvote')}
            className={cn(
              'rounded p-0.5 transition-colors',
              myVote === 1
                ? 'text-primary'
                : 'text-muted-foreground hover:bg-primary/10 hover:text-primary',
              (!isAuthenticated || isMine) && 'cursor-not-allowed opacity-40',
            )}
          >
            <ChevronUp className={cn('size-5', myVote === 1 && 'stroke-[2.5]')} />
          </button>
          <span
            className={cn(
              'font-mono text-xs font-semibold tabular-nums',
              score > 0 && 'text-primary',
              score < 0 && 'text-destructive',
              score === 0 && 'text-muted-foreground',
            )}
            aria-label={t('score')}
          >
            {score}
          </span>
          <button
            type="button"
            onClick={() => cast(myVote === -1 ? 0 : -1)}
            disabled={!isAuthenticated || isMine}
            aria-label={t('downvote')}
            aria-pressed={myVote === -1}
            title={isMine ? t('cannotVoteOwn') : t('downvote')}
            className={cn(
              'rounded p-0.5 transition-colors',
              myVote === -1
                ? 'text-destructive'
                : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
              (!isAuthenticated || isMine) && 'cursor-not-allowed opacity-40',
            )}
          >
            <ChevronDown className={cn('size-5', myVote === -1 && 'stroke-[2.5]')} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {/* Author */}
          <header className="mb-2 flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {profileHref ? (
                <Link href={profileHref} className="shrink-0" aria-label={authorName}>
                  <Avatar className="size-8">
                    {author?.avatarUrl && <AvatarImage src={author.avatarUrl} alt={authorName} />}
                    <AvatarFallback className="text-2xs">{initialsOf(author?.name, author?.username)}</AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar className="size-8">
                  <AvatarFallback className="text-2xs">?</AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-tight">
                  {profileHref ? (
                    <Link href={profileHref} className="truncate font-semibold text-foreground hover:underline">
                      {authorName}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-foreground">{authorName}</span>
                  )}
                  {roleLabel && (
                    <span className="rounded-sm border border-primary/30 bg-primary/10 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                      {roleLabel}
                    </span>
                  )}
                  {authorHandle && <span className="truncate font-mono text-2xs text-muted-foreground">{authorHandle}</span>}
                  <span className="text-2xs text-muted-foreground">·</span>
                  <time
                    dateTime={post.createdAt}
                    className="shrink-0 font-mono text-2xs text-muted-foreground"
                    title={post.createdAt ?? undefined}
                  >
                    {post.createdAt ? timeAgo(post.createdAt) : ''}
                  </time>
                </p>
                {author?.headline && (
                  <p className="truncate text-2xs text-muted-foreground">{author.headline}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <PostAiActions post={post as never} />
              {isMine && onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={t('postActions')}>
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onDelete(post.id)} className="text-destructive">
                      <Trash2 className="size-4" />
                      {t('deletePost')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="mb-2 w-full text-start"
            aria-expanded={!collapsed}
          >
            <p
              className={cn(
                'whitespace-pre-line text-sm leading-relaxed text-foreground',
                collapsed && 'line-clamp-3',
              )}
            >
              {post.content}
            </p>
            {!collapsed && post.content.length > 320 && (
              <span className="mt-1 inline-block text-2xs font-medium text-primary">{t('collapse')}</span>
            )}
          </button>

          {media.length > 0 && !collapsed && (
            <div className="relative mb-3 overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media[mediaIdx]}
                alt=""
                className="max-h-96 w-full object-cover"
                loading="lazy"
              />
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setMediaIdx((i) => (i - 1 + media.length) % media.length)}
                    className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur transition hover:bg-background"
                  >
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setMediaIdx((i) => (i + 1) % media.length)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur transition hover:bg-background"
                  >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                    {media.map((_, i) => (
                      <span
                        key={i}
                        className={cn('h-1.5 w-1.5 rounded-full bg-card', i === mediaIdx ? 'opacity-100' : 'opacity-50')}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tags: real, clickable, and they filter the feed. */}
          {post.tags?.length ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={`/tags/${tag.slug}`}
                    className="inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                  >
                    {tag.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setThreadOpen((open) => !open)}
              aria-expanded={threadOpen}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors',
                threadOpen
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary',
              )}
            >
              <MessageCircle className="size-4" />
              {(post.commentCount ?? 0) > 0 ? post.commentCount : t('comment')}
            </button>
          </div>

          {threadOpen && (
            <CommentThread
              postId={post.id}
              focusCommentId={focusCommentId}
              className="mt-3"
            />
          )}
        </div>
      </div>
    </article>
  );
}
