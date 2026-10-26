import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Hash } from 'lucide-react';
import { FeedStream } from '@/components/feed/feed-stream';
import type { WireSnapshot } from '@/lib/feed';

function snippet(content: string, max = 140) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Hero traffic ticker — the `feed-ticker` island. */
export async function FeedTicker({ snapshot }: { snapshot: WireSnapshot }) {
  const t = await getTranslations('pages.feed');
  const ticker = snapshot.posts.slice(0, 8);
  if (ticker.length === 0) return null;

  return (
    <div className="relative border-y border-border bg-overlay text-white">
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex items-stretch gap-0 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-e border-white/10 py-2.5 pe-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('onAir')}
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max animate-none gap-8 py-2.5 ps-4 [animation:marquee_40s_linear_infinite] hover:[animation-play-state:paused]">
            {[...ticker, ...ticker].map((p, i) => (
              <span
                key={`${p.id}-${i}`}
                className="inline-flex max-w-md shrink-0 items-center gap-2 font-mono text-xs text-white/70"
              >
                <span className="text-primary">›</span>
                <span className="truncate">{snippet(p.content, 90)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Topic index island — the `feed-topics` island. */
export async function FeedTopics({ snapshot }: { snapshot: WireSnapshot }) {
  const t = await getTranslations('pages.feed');
  return (
    <section
      id="topics"
      className="border-b border-border bg-surface-sunken/50 px-margin-mobile md:px-margin-desktop py-14 md:py-18"
    >
      <div className="max-w-container-max mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {t('topicsTitle')}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {t('topicsBlurb')}
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t('topicsHint')}
          </p>
        </div>

        {snapshot.topics.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            {t('topicsEmpty')}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {snapshot.topics.map((topic, i) => (
              <li key={topic.tag}>
                {/* Tags have real pages now, so the index should lead there. */}
                <a
                  href={`/tags/${encodeURIComponent(topic.tag)}`}
                  className="group inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-xs transition-colors hover:border-primary/40"
                >
                  <span className="font-mono text-[10px] font-semibold text-border-strong tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Hash className="size-3.5 text-primary" />
                  <span className="font-mono text-xs font-medium text-foreground group-hover:text-primary">
                    {topic.tag}
                  </span>
                  <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground tabular-nums">
                    {topic.count}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Live wire + side rail — the `feed-wire` island. */
export async function FeedWire({ snapshot }: { snapshot: WireSnapshot }) {
  const t = await getTranslations('pages.feed');
  return (
    <section
      id="live-wire"
      className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-6 max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {t('wireTitle')}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {t('wireBlurb')}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t('wireHint')}
            </p>
          </div>
          <FeedStream embedded />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              {t('wireStatus')}
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                { label: t('publicPosts'), value: snapshot.postCount },
                { label: t('authors'), value: snapshot.activeAuthors },
                { label: t('topicTags'), value: snapshot.topics.length },
                { label: t('engagements'), value: snapshot.likeCount + snapshot.commentCount },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              {t('takeFurther')}
            </p>
            <ul className="mt-3 space-y-2">
              {[
                { href: '/academy', label: 'Academy pathways' },
                { href: '/products', label: 'Tool crib' },
                { href: '/events', label: 'Shop events' },
                { href: '/feed?scope=following', label: 'Your following feed' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-surface-sunken"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 text-primary opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

/**
 * Labels come from the caller: this runs in the async route page, and taking a
 * translator keeps the numbers locale-aware instead of hardcoded English.
 */
/**
 * Hero stats helper shared by the feed route (live counters).
 *
 * The implementation lives in `lib/catalog-stats` so the builder canvas can use
 * the exact same arithmetic without importing this server module.
 */
export { feedHeroStats } from '@/lib/catalog-stats';
