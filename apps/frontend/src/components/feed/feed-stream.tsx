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
import { AnimatePresence, Crossfade, Stagger, StaggerItem, m } from '@/components/ui/motion';
import { ActivePill } from '@/components/feed/feed-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/format';
import { spring, transition } from '@/lib/motion';
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
  const tu = useTranslations('ui.feed');
  const tc = useTranslations('common');
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
      onSuccess: () => toast({ type: 'ok', title: t('postDeleted') }),
      onError: () => toast({ type: 'err', title: t('deleteFailed') }),
    });

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await createPost.mutateAsync({ content, tags: draftTags });
      setDraft('');
      setDraftTags([]);
      setComposerOpen(false);
      toast({ type: 'ok', title: t('postCreated') });
    } catch {
      toast({ type: 'err', title: t('postFailed') });
    }
  };

  const scopeTabs = [
    { value: 'discover' as const, label: t('discover'), Icon: Compass },
    { value: 'following' as const, label: t('myFeed'), Icon: Users },
  ];
  const sortTabs = [
    { value: 'hot' as const, label: t('sort.hot'), Icon: Flame },
    { value: 'new' as const, label: t('sort.new'), Icon: Radio },
    { value: 'top' as const, label: t('sort.top'), Icon: TrendingUp },
  ];

  return (
    <section
      id="feed-stream"
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-surface-sunken/40 shadow-xs',
        embedded && 'w-full',
      )}
    >
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 bg-card px-4 pb-4 pt-5 md:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {tu('live')}
            <span className="hidden text-muted-foreground/60 sm:inline">·</span>
            <span className="hidden sm:inline">{tu('communityWire')}</span>
          </p>
          <Crossfade value={scope} axis="y" className="mt-1">
            <h2 className="font-display text-2xl font-medium tracking-[-0.018em] text-foreground">
              {scope === 'discover' ? t('discover') : t('myFeed')}
            </h2>
          </Crossfade>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center rounded-full border border-border/70 bg-muted/60 p-0.5"
            role="tablist"
            aria-label={t('title')}
          >
            {scopeTabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={scope === value}
                onClick={() => setScope(value)}
                className={cn(
                  'relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  scope === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {scope === value && <ActivePill layoutId="feed-scope-pill" />}
                <span className="relative inline-flex items-center gap-1.5">
                  <Icon className={cn('size-3.5', scope === value && 'text-primary')} />
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div
            className="flex items-center rounded-full border border-border/70 bg-muted/60 p-0.5"
            role="tablist"
            aria-label={t('sortBy')}
          >
            {sortTabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
                className={cn(
                  'relative inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
                  sort === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {sort === value && <ActivePill layoutId="feed-sort-pill" />}
                <span className="relative inline-flex items-center gap-1.5">
                  <Icon className={cn('size-3.5', sort === value && 'text-primary')} />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tag filter, built from the tenant's real tag index. */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-card px-4 py-2.5 md:px-6">
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <Tag className="size-3" />
            {t('tags')}
          </span>
          <button
            type="button"
            onClick={() => setTag(undefined)}
            aria-pressed={!activeTag}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              !activeTag
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
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
                'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                activeTag === tag.slug
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/70 bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {tag.label}
              {typeof tag.usageCount === 'number' && (
                <span className="ms-1 tabular-nums text-muted-foreground/70">{tag.usageCount}</span>
              )}
            </button>
          ))}
          <AnimatePresence initial={false}>
            {activeTag && (
              <m.button
                key="clear-tag"
                type="button"
                onClick={() => setTag(undefined)}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0, transition: transition.enter }}
                exit={{ opacity: 0, x: 6, transition: transition.leave }}
                className="ms-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <X className="size-3" />
                {t('clearTag')}
              </m.button>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-4 p-4 md:p-6">
        {/* Composer card — a calm prompt that opens the full composer. */}
        {isAuthenticated && (
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs sm:p-4">
            <Avatar className="size-9 shrink-0 ring-1 ring-border/60">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name ?? ''} />}
              <AvatarFallback className="text-2xs">{initialsOf(user?.name, user?.username)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="min-w-0 flex-1 truncate rounded-full border border-border/70 bg-muted/40 px-4 py-2 text-start text-sm text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/70"
            >
              {t('createPostPlaceholder')}
            </button>
            <Button size="sm" onClick={() => setComposerOpen(true)} className="shrink-0">
              <PenLine className="size-3.5" />
              <span className="hidden sm:inline">{t('createPost')}</span>
            </Button>
          </div>
        )}

        {/* Result meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {!isLoading && !isError ? tu('onWireCount', { count: posts.length }) : ' '}
          </p>
        </div>

        {/* Posts */}
        <Crossfade value={`${scope}-${sort}-${activeTag ?? ''}-${isLoading ? 'l' : isError ? 'e' : posts.length === 0 ? '0' : 'p'}`} axis="none">
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
            /* Posts cascade in, but only the first screenful: `Stagger`'s
               maxDelay cap means item 30 doesn't wait 30x the step. New posts
               slide in at the top and the rest glide down via `layout`. */
            <Stagger className="space-y-4" gap={0.04} maxDelay={0.32}>
              <AnimatePresence>
                {posts.map((post, i) => (
                  <StaggerItem key={post.id} index={i} layout="position" transition={spring.layout}>
                    <PostCard
                      post={post}
                      currentUserId={user?.id}
                      onVote={onVote}
                      onDelete={isAuthenticated ? onDelete : undefined}
                    />
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </Stagger>
          )}
        </Crossfade>
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
                    <m.li
                      key={tag}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
                    >
                      <button
                        type="button"
                        onClick={() => setDraftTags((current) => current.filter((entry) => entry !== tag))}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        {tag}
                        <X className="size-2.5" />
                      </button>
                    </m.li>
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
                className="h-9 text-sm"
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
              {tc('cancel')}
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
