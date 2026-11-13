'use client';
import { rememberListCount } from '@/lib/admin-shape-memory';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Hash, Loader2, Search, TrendingUp } from 'lucide-react';
import { PostCard } from '@/components/feed/post-card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useFeedTags, useTagPage, useVotePost, type FeedSort } from '@/hooks/use-feed';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { AnimatePresence, Crossfade, Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { ActivePill } from '@/components/feed/feed-motion';

// Literal label keys rather than `t(`sort.${option}`)`: a template key is
// assembled at runtime, so a typo or a stale bundle is invisible in review.
const SORTS: ReadonlyArray<{ value: FeedSort; labelKey: string }> = [
  { value: 'hot', labelKey: 'sort.hot' },
  { value: 'new', labelKey: 'sort.new' },
  { value: 'top', labelKey: 'sort.top' },
];

/** One tag: its description, its usage count, and the posts carrying it. */
export function TagView({ slug }: { slug: string }) {
  const t = useTranslations('tags');
  const user = useAuthStore((state) => state.user);
  const [sort, setSort] = useState<FeedSort>('hot');
  const { data, isPending, isError, refetch } = useTagPage(slug, sort);
  const votePost = useVotePost();

  const posts = data?.feed?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 md:py-14">
      <Reveal as="header" className="space-y-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
            <Hash className="size-3" />
          </span>
          {t('tag')}
        </p>
        <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
          {isPending ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : (data?.label ?? slug)}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {data ? t('postCount', { count: data.usageCount ?? 0 }) : ''}
          {data?.description ? ` · ${data.description}` : ''}
        </p>
      </Reveal>

      <div
        className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 p-0.5"
        role="tablist"
        aria-label={t('sortBy')}
      >
        {SORTS.map(({ value, labelKey }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={sort === value}
            onClick={() => setSort(value)}
            className={cn(
              'relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              sort === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {sort === value && <ActivePill layoutId="tag-sort-pill" />}
            <span className="relative inline-flex items-center gap-1.5">
              {value === 'top' && <TrendingUp className="size-3" />}
              {t(labelKey)}
            </span>
          </button>
        ))}
      </div>

      <Crossfade value={`${sort}-${isPending ? 'l' : isError ? 'e' : posts.length === 0 ? '0' : 'p'}`} axis="none">
      {isPending ? (
        <LoadingState rows={3} />
      ) : isError ? (
        <ErrorState title={t('loadFailed')} onRetry={() => void refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState icon={Hash} title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <Stagger className="space-y-4" gap={0.04} maxDelay={0.32}>
          <AnimatePresence>
            {posts.map((post, i) => (
              <StaggerItem key={post.id} index={i} layout="position">
                <PostCard
                  post={post}
                  currentUserId={user?.id}
                  onVote={(postId, value) => votePost.mutate({ postId, value })}
                />
              </StaggerItem>
            ))}
          </AnimatePresence>
        </Stagger>
      )}
      </Crossfade>

      <Link href="/tags" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {t('backToTags')}
      </Link>
    </div>
  );
}

/** The whole tag index, searchable. */
export function TagIndex() {
  const t = useTranslations('tags');
  const { tags, isPending, isError, refetch } = useFeedTags();

  // The /tags skeleton draws as many tag tiles as the index last showed.
  useEffect(() => {
    if (!isPending && !isError) rememberListCount('public-tags', tags.length);
  }, [isPending, isError, tags.length]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(
      (tag) => tag.slug.includes(needle) || tag.label.toLowerCase().includes(needle),
    );
  }, [tags, search]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 md:py-14">
      <Reveal as="header" className="space-y-3">
        <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{t('description', { count: tags.length })}</p>
      </Reveal>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>

      {isPending ? (
        <LoadingState rows={2} />
      ) : isError ? (
        <ErrorState title={t('loadFailed')} onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Hash} title={t('noResults')} description={t('noResultsHint')} />
      ) : (
        <Stagger
          as="ul"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          gap={0.025}
          maxDelay={0.3}
        >
          <AnimatePresence>
          {filtered.map((tag, i) => (
            <StaggerItem as="li" key={tag.slug} index={i} layout="position">
              <Link
                href={`/tags/${tag.slug}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Hash className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {tag.label}
                    </span>
                    <span className="block truncate font-mono text-2xs text-muted-foreground">
                      /{tag.slug}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {tag.usageCount ?? 0}
                </span>
              </Link>
            </StaggerItem>
          ))}
          </AnimatePresence>
        </Stagger>
      )}
    </div>
  );
}
