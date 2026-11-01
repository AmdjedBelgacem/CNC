'use client';

import { useId, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, CornerDownRight, MessageSquare, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import {
  type CommentSort,
  useAddComment,
  useComments,
  useDeleteComment,
  useVoteComment,
} from '@/hooks/use-feed';
import { useAuthStore } from '@/stores/auth-store';
import { initialsOf, timeAgo } from '@/lib/format';

import type { FeedComment } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { spring, transition } from '@/lib/motion';
import { ActivePill, Collapse, FadeSlot, RollingNumber, SpringButton } from '@/components/feed/feed-motion';

const SORTS: ReadonlyArray<{ value: CommentSort; labelKey: string }> = [
  { value: 'best', labelKey: 'commentSort.best' },
  { value: 'new', labelKey: 'commentSort.new' },
  { value: 'old', labelKey: 'commentSort.old' },
];

/** How deep the thread indents before replies stop shifting sideways. */
const INDENT_CAP = 5;

/**
 * A post's comments as a thread.
 *
 * The whole tree arrives in one request and replies are rendered in place, so
 * opening a post with 200 comments costs one round trip rather than one per level.
 */
export function CommentThread({
  postId,
  focusCommentId,
  className,
}: {
  postId: string;
  focusCommentId?: string | null;
  className?: string;
}) {
  const t = useTranslations('feed');
  const [sort, setSort] = useState<CommentSort>('best');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const viewerId = useAuthStore((state) => state.user?.id);
  const { comments, isPending, isError, refetch } = useComments(postId, true, sort);
  const addComment = useAddComment(postId);

  const total = useMemo(() => countNodes(comments), [comments]);
  const pillId = `comment-sort-${useId()}`;

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await addComment.mutateAsync({ content, parentId: replyTo?.id ?? null });
      setDraft('');
      setReplyTo(null);
    } catch {
      toast({ type: 'err', title: t('commentFailed') });
    }
  };

  return (
    <section className={cn('overflow-hidden rounded-xl border border-border/70 bg-muted/30', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t('comments')} · <span className="tabular-nums">{total}</span>
        </p>
        <div
          className="flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5"
          role="group"
          aria-label={t('sortComments')}
        >
          {SORTS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={cn(
                'relative rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                sort === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {sort === value && <ActivePill layoutId={pillId} />}
              <span className="relative">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </header>

      {isPending ? (
        <LoadingState label={t('loadingComments')} />
      ) : isError ? (
        <p className="px-4 py-4 text-xs text-destructive">
          {t('commentsFailed')}{' '}
          <button type="button" onClick={() => void refetch()} className="underline">
            {t('retry')}
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">{t('noCommentsYet')}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          <AnimatePresence initial={false}>
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              postId={postId}
              viewerId={viewerId}
              depth={0}
              collapsedMap={collapsed}
              onToggleCollapse={(id) => setCollapsed((current) => ({ ...current, [id]: !current[id] }))}
              onReply={(target) => {
                setReplyTo(target);
                setDraft('');
              }}
              highlighted={focusCommentId === comment.id || hasDescendant(comment, focusCommentId)}
            />
          ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Composer */}
      {isAuthenticated ? (
        <div className="border-t border-border/60 bg-card/60 p-3 sm:p-4">
          <FadeSlot show={!!replyTo}>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" />
              {t('replyingTo')} {replyTo?.author?.name || t('unknownAuthor')}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-medium text-primary hover:underline"
              >
                {t('cancelReply')}
              </button>
            </p>
          </FadeSlot>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={replyTo ? t('replyPlaceholder') : t('commentPlaceholder')}
            aria-label={t('commentPlaceholder')}
            className="text-sm"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t('commentHint')}</p>
            <Button
              type="button"
              size="sm"
              onClick={() => void submit()}
              disabled={!draft.trim() || addComment.isPending}
              loading={addComment.isPending}
            >
              {replyTo ? t('postReply') : t('postComment')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('signInToComment')}
          </Link>
        </p>
      )}
    </section>
  );
}

function CommentNode({
  comment,
  postId,
  viewerId,
  depth,
  collapsedMap,
  onToggleCollapse,
  onReply,
  highlighted,
}: {
  comment: FeedComment;
  postId: string;
  viewerId?: string;
  depth: number;
  collapsedMap: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onReply: (comment: FeedComment) => void;
  highlighted: boolean;
}) {
  const t = useTranslations('feed');
  const vote = useVoteComment(postId);
  const remove = useDeleteComment(postId);
  const [showReplies, setShowReplies] = useState(true);

  const isCollapsed = collapsedMap[comment.id] === true;
  const replies = comment.replies ?? [];
  const indent = Math.min(depth, INDENT_CAP);
  const isMine = !!viewerId && comment.userId === viewerId;
  const author = comment.author;

  if (comment.isRemoved) {
    // The slot stays so replies keep their place, but nothing about the author
    // or the text is disclosed.
    return (
      <m.li
        layout="position"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        exit={{ opacity: 0, transition: transition.leave }}
        className={cn('px-4 py-2.5', highlighted && 'bg-primary/5')}
      >
        <p className="text-xs italic text-muted-foreground">{t('commentRemoved')}</p>
        {replies.length > 0 && (
          <ul className="mt-1 space-y-1">
            {replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                postId={postId}
                viewerId={viewerId}
                depth={depth + 1}
                collapsedMap={collapsedMap}
                onToggleCollapse={onToggleCollapse}
                onReply={onReply}
                highlighted={highlighted}
              />
            ))}
          </ul>
        )}
      </m.li>
    );
  }

  return (
    <m.li
      layout="position"
      transition={spring.layout}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: transition.enter }}
      exit={{ opacity: 0, transition: transition.leave }}
      id={`comment-${comment.id}`}
      className={cn('px-4 py-3 transition-colors', highlighted && 'bg-primary/5')}
      style={indent ? { paddingInlineStart: `${16 + indent * 14}px` } : undefined}
    >
      <div className="flex gap-2">
        {author?.username ? (
          <Link href={`/u/${author.username}`} className="shrink-0" aria-label={author.name ?? author.username}>
            <Avatar className="size-7">
              {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={author.name ?? ''} />}
              <AvatarFallback className="text-2xs">{initialsOf(author.name, author.username)}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Avatar className="size-7">
            <AvatarFallback className="text-2xs">?</AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-tight">
            <span className="font-semibold text-foreground">
              {author?.name || author?.username || t('unknownAuthor')}
            </span>
            {author?.username && <span className="text-muted-foreground">@{author.username}</span>}
            <span className="text-muted-foreground/60">·</span>
            <time dateTime={comment.createdAt} className="text-muted-foreground">
              {comment.createdAt ? timeAgo(comment.createdAt) : ''}
            </time>
            {comment.editedAt && <span className="text-muted-foreground">· {t('edited')}</span>}
          </p>

          {!isCollapsed && (
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
              {comment.content}
            </p>
          )}

          <div className="-ms-1 mt-1.5 flex items-center gap-1">
            <SpringButton
              type="button"
              onClick={() => vote.mutate({ commentId: comment.id, value: (comment.myVote ?? 0) === 1 ? 0 : 1 })}
              disabled={!viewerId || isMine}
              aria-label={t('upvote')}
              aria-pressed={(comment.myVote ?? 0) === 1}
              active={(comment.myVote ?? 0) === 1}
              className={cn(
                'grid size-6 place-items-center rounded-full transition-colors',
                (comment.myVote ?? 0) === 1
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-primary',
                (!viewerId || isMine) && 'cursor-not-allowed opacity-40',
              )}
            >
              <ChevronUp className="size-4" />
            </SpringButton>
            <RollingNumber
              value={comment.score}
              className={cn(
                'min-w-4 justify-center text-xs font-semibold',
                comment.score > 0 && 'text-primary',
                comment.score < 0 && 'text-destructive',
                comment.score === 0 && 'text-muted-foreground',
              )}
            />
            <SpringButton
              type="button"
              onClick={() => vote.mutate({ commentId: comment.id, value: (comment.myVote ?? 0) === -1 ? 0 : -1 })}
              disabled={!viewerId || isMine}
              aria-label={t('downvote')}
              aria-pressed={(comment.myVote ?? 0) === -1}
              active={(comment.myVote ?? 0) === -1}
              className={cn(
                'grid size-6 place-items-center rounded-full transition-colors',
                (comment.myVote ?? 0) === -1
                  ? 'text-destructive'
                  : 'text-muted-foreground hover:text-destructive',
                (!viewerId || isMine) && 'cursor-not-allowed opacity-40',
              )}
            >
              <ChevronDown className="size-4" />
            </SpringButton>

            <button
              type="button"
              onClick={() => onReply(comment)}
              disabled={!viewerId}
              className="ms-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-40"
            >
              <MessageSquare className="size-3" />
              {t('reply')}
            </button>

            {replies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((value) => !value)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showReplies ? t('hideReplies') : t('showReplies')} ({replies.length})
              </button>
            )}

            {isMine && (
              <button
                type="button"
                onClick={() => remove.mutate(comment.id)}
                aria-label={t('deleteComment')}
                className="ms-auto grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <Collapse open={replies.length > 0 && showReplies && !isCollapsed}>
            <ul className="mt-1.5 space-y-1 border-s border-border/70 ps-2">
              {replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  viewerId={viewerId}
                  depth={depth + 1}
                  collapsedMap={collapsedMap}
                  onToggleCollapse={onToggleCollapse}
                  onReply={onReply}
                  highlighted={highlighted}
                />
              ))}
            </ul>
          </Collapse>
        </div>
      </div>
    </m.li>
  );
}

function countNodes(nodes: FeedComment[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.replies ?? []), 0);
}

/** Highlights a thread when a notification deep-links to a reply in it. */
function hasDescendant(node: FeedComment, targetId?: string | null): boolean {
  if (!targetId) return false;
  if (node.id === targetId) return true;
  return (node.replies ?? []).some((reply) => hasDescendant(reply, targetId));
}
