'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Hash, Loader2, Search, TrendingUp } from 'lucide-react';
import { PostCard } from '@/components/feed/post-card';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useFeedTags, useTagPage, useVotePost, type FeedSort } from '@/hooks/use-feed';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Stagger, StaggerItem } from '@/components/ui/motion';

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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <header className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Hash className="size-3" />
          {t('tag')}
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {isPending ? <Loader2 className="size-5 animate-spin" /> : (data?.label ?? slug)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data ? t('postCount', { count: data.usageCount ?? 0 }) : ''}
          {data?.description ? ` · ${data.description}` : ''}
        </p>
      </header>

      <div className="flex items-center gap-1" role="tablist" aria-label={t('sortBy')}>
        {SORTS.map(({ value, labelKey }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={sort === value}
            onClick={() => setSort(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
              sort === value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {value === 'top' && <TrendingUp className="size-3" />}
            {t(labelKey)}
          </button>
        ))}
      </div>

      {isPending ? (
        <LoadingState rows={3} />
      ) : isError ? (
        <ErrorState title={t('loadFailed')} onRetry={() => void refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState icon={Hash} title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onVote={(postId, value) => votePost.mutate({ postId, value })}
            />
          ))}
        </div>
      )}

      <Link href="/tags" className="inline-block text-xs font-medium text-primary hover:underline">
        {t('backToTags')}
      </Link>
    </div>
  );
}

/** The whole tag index, searchable. */
export function TagIndex() {
  const t = useTranslations('tags');
  const { tags, isPending, isError, refetch } = useFeedTags();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(
      (tag) => tag.slug.includes(needle) || tag.label.toLowerCase().includes(needle),
    );
  }, [tags, search]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Hash className="size-3" />
          {t('title')}
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('description', { count: tags.length })}</p>
      </header>

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
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          gap={0.025}
          maxDelay={0.3}
        >
          {filtered.map((tag, i) => (
            <StaggerItem as="li" key={tag.slug} index={i}>
              <Link
                href={`/tags/${tag.slug}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-medium text-foreground">
                    {tag.label}
                  </span>
                  <span className="block truncate font-mono text-2xs text-muted-foreground">
                    /{tag.slug}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs tabular-nums text-muted-foreground">
                  {tag.usageCount ?? 0}
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
