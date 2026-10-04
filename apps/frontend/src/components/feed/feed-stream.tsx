'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, Flame, Loader2, PenLine, Radio, Tag, TrendingUp, Users, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type FeedSort,
  useCreatePost,
  useDeletePost,
  useFeed,
  useFeedTags,
  useVotePost,
} from '@/hooks/use-feed';
import { PostCard } from '@/components/feed/post-card';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export function FeedStream({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('feed');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [scope, setScope] = useState<'discover' | 'following'>('discover');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [sort, setSort] = useState<FeedSort>('hot');
  // A tag filter lives in the URL so a filtered feed can be shared or reloaded.
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTag = searchParams.get('tag') ?? undefined;
  const { tags: allTags } = useFeedTags();
  const votePost = useVotePost();

  const setTag = (slug?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('tag', slug);
    else params.delete('tag');
    router.replace(params.toString() ? `/feed?${params.toString()}` : '/feed', { scroll: false });
  };

  const { posts, isLoading, isError, error, refetch } = useFeed(
    scope,
    // "Following" requires a session; skip the request when signed out.
    scope === 'discover' || isAuthenticated,
    { sort, tag: activeTag },
  );
  const createPost = useCreatePost();
  const deletePost = useDeletePost();

  const onVote = (postId: string, value: number) => votePost.mutate({ postId, value });
  const onDelete = (postId: string) =>
    deletePost.mutate(postId, {
      onSuccess: () => toast({ type: 'ok', title: t('deletePost') }),
      onError: () => toast({ type: 'err', title: t('loadFailed') }),
    });

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await createPost.mutateAsync({ content, tags: draftTags });
      setDraft('');
      setDraftTags([]);
      setComposerOpen(false);
      toast({ type: 'ok', title: t('post') });
    } catch {
      toast({ type: 'err', title: t('loadFailed') });
    }
  };

  return (
    <section
      id="feed-stream"
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-xs',
        embedded && 'w-full',
      )}
    >
      {/* Wire header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/50 px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
            <Radio className="size-3" />
            Live
          </span>
          <div className="hidden sm:block">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Community wire
            </p>
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">
              {scope === 'discover' ? t('discover') : t('myFeed')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center rounded-md border border-border bg-surface-sunken/60 p-0.5"
            role="tablist"
            aria-label={t('title')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'discover'}
              onClick={() => setScope('discover')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                scope === 'discover'
                  ? 'bg-card text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Compass className="size-3.5" />
              {t('discover')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'following'}
              onClick={() => setScope('following')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                scope === 'following'
                  ? 'bg-card text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className="size-3.5" />
              {t('myFeed')}
            </button>
          </div>

          <div
            className="flex items-center rounded-md border border-border bg-surface-sunken/60 p-0.5"
            role="tablist"
            aria-label={t('sortBy')}
          >
            {([
              { value: 'hot' as const, label: t('sort.hot'), Icon: Flame },
              { value: 'new' as const, label: t('sort.new'), Icon: Radio },
              { value: 'top' as const, label: t('sort.top'), Icon: TrendingUp },
            ]).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                  sort === value ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {isAuthenticated && (
            <Button size="sm" onClick={() => setComposerOpen(true)} className="h-8 px-3">
              <PenLine className="size-3.5" />
              {t('createPost')}
            </Button>
          )}
        </div>
      </header>

      {/* Tag filter, built from the tenant's real tag index. */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2 md:px-5">
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Tag className="size-3" />
            {t('tags')}
          </span>
          <button
            type="button"
            onClick={() => setTag(undefined)}
            aria-pressed={!activeTag}
            className={cn(
              'shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
              !activeTag
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {t('allTags')}
          </button>
          {allTags.slice(0, 18).map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => setTag(activeTag === tag.slug ? undefined : tag.slug)}
              aria-pressed={activeTag === tag.slug}
              className={cn(
                'shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
                activeTag === tag.slug
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {tag.label}
              {typeof tag.usageCount === 'number' && (
                <span className="ms-1 text-muted-foreground/70">{tag.usageCount}</span>
              )}
            </button>
          ))}
          {activeTag && (
            <button
              type="button"
              onClick={() => setTag(undefined)}
              className="ms-auto inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-primary hover:underline"
            >
              <X className="size-3" />
              {t('clearTag')}
            </button>
          )}
        </div>
      )}

      {/* Result meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-sunken/30 px-4 py-2.5 md:px-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {t('subtitle')}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {!isLoading && !isError ? `${posts.length} on wire` : ' '}
        </p>
      </div>

      {/* Posts */}
      <div className="p-4 md:p-5">
        {isLoading ? (
          <LoadingState rows={3} />
        ) : isError ? (
          <ErrorState
            title={t('loadFailed')}
            description={(error as Error)?.message}
            onRetry={() => void refetch()}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={t('empty')}
            description={scope === 'following' ? t('emptyHint') : t('emptyHint')}
            action={
              isAuthenticated ? (
                <Button variant="outline" size="sm" onClick={() => setComposerOpen(true)}>
                  <PenLine />
                  {t('createPost')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="relative space-y-4">
            {/* Wire rail */}
            <span
              aria-hidden
              className="absolute inset-y-2 -start-4 w-px bg-border md:-start-5"
            />
            // Posts cascade in, but only the first screenful: `Stagger`'s
            // maxDelay cap means item 30 doesn't wait 30× the step, so a long
            // wire doesn't take seconds to finish appearing.
            <Stagger className="relative space-y-4" gap={0.04} maxDelay={0.32}>
              {posts.map((post, i) => (
                <StaggerItem key={post.id} index={i}>
                  <div className="relative">
                    <span
                      aria-hidden
                      className="absolute -start-4 top-8 size-1.5 -translate-x-1/2 rounded-full bg-primary md:-start-5"
                    />
                    <PostCard
                      post={post}
                      currentUserId={user?.id}
                      onVote={onVote}
                      onDelete={isAuthenticated ? onDelete : undefined}
                    />
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}
      </div>

      {/* Create post — a modal, not a side sheet. */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t('createPost')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              {draftTags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {draftTags.map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        onClick={() => setDraftTags((current) => current.filter((entry) => entry !== tag))}
                        className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-primary"
                      >
                        {tag}
                        <X className="size-2.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ',') return;
                  event.preventDefault();
                  const value = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
                  if (value && !draftTags.includes(value) && draftTags.length < 8) {
                    setDraftTags((current) => [...current, value]);
                  }
                  setTagInput('');
                }}
                placeholder={t('addTagPlaceholder')}
                aria-label={t('addTagPlaceholder')}
                list="feed-tag-suggestions"
                className="h-8 font-mono text-xs"
              />
              <datalist id="feed-tag-suggestions">
                {allTags.slice(0, 40).map((tag) => (
                  <option key={tag.slug} value={tag.slug} />
                ))}
              </datalist>
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('createPostPlaceholder')}
              rows={5}
              className="resize-none"
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={!draft.trim()} loading={createPost.isPending}>
              {createPost.isPending ? <Loader2 /> : <PenLine />}
              {t('post')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
