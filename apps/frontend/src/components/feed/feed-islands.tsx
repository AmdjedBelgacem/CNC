import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Hash } from 'lucide-react';
import { FeedStream } from '@/components/feed/feed-stream';
import type { WireSnapshot } from '@/lib/feed';
import { cn } from '@/lib/utils';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

type IslandChrome = {
  /** Builder-authored header nodes. Arabic pages omit it and keep the translated header. */
  header?: ReactNode;
  /** Builder canvas preview: render the live rows without the header. */
  bodyOnly?: boolean;
  /**
   * Canvas-only: reserve the authored header's height inside the public grid
   * while the editable header is overlaid on top of the iframe.
   */
  headerSpacerHeight?: number;
};

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
    <div className="relative border-y border-border/70 bg-card text-foreground">
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex items-stretch gap-0 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-e border-border/70 py-3 pe-4 text-xs font-medium text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          {t('onAir')}
        </div>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <div className="flex w-max animate-none gap-10 py-3 ps-4 [animation:marquee_40s_linear_infinite] hover:[animation-play-state:paused]">
            {[...ticker, ...ticker].map((p, i) => (
              <span
                key={`${p.id}-${i}`}
                className="inline-flex max-w-md shrink-0 items-center gap-2.5 text-sm text-muted-foreground"
              >
                <span className="size-1 rounded-full bg-primary/60" aria-hidden />
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
export async function FeedTopics({
  snapshot,
  header,
  bodyOnly,
}: { snapshot: WireSnapshot } & IslandChrome) {
  const t = await getTranslations('pages.feed');
  return (
    <section
      id="topics"
      className={cn(
        'border-b border-border/70 bg-surface-sunken/40 px-margin-mobile md:px-margin-desktop py-16 md:py-20',
        bodyOnly && 'pt-0 md:pt-0',
      )}
    >
      <div className="max-w-container-max mx-auto">
        {bodyOnly
          ? null
          : header ?? (
              <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">{t('topicsTitle')}</p>
                  <h2 className="mt-3 text-balance font-display text-2xl font-medium tracking-[-0.018em] text-foreground md:text-3xl">
                    {t('topicsBlurb')}
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t('topicsHint')}</p>
              </Reveal>
            )}

        {snapshot.topics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center text-sm text-muted-foreground">
            {t('topicsEmpty')}
          </p>
        ) : (
          <Stagger as="ul" inViewOnly className="flex flex-wrap gap-2" gap={0.03} maxDelay={0.36}>
            {snapshot.topics.map((topic, i) => (
              <StaggerItem as="li" key={topic.tag} index={i}>
                {/* Tags have real pages now, so the index should lead there. */}
                <a
                  href={`/tags/${encodeURIComponent(topic.tag)}`}
                  className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card py-1.5 pe-1.5 ps-3 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
                >
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Hash className="size-3.5 text-primary" />
                  <span className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {topic.tag}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {topic.count}
                  </span>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </section>
  );
}

/** Live wire + side rail — the `feed-wire` island. */
export async function FeedWire({
  snapshot,
  header,
  bodyOnly,
  headerSpacerHeight = 0,
}: { snapshot: WireSnapshot } & IslandChrome) {
  const t = await getTranslations('pages.feed');
  return (
    <section
      id="live-wire"
      className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-16 md:py-24"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:gap-12">
        <div className="min-w-0">
          {bodyOnly ? (
            headerSpacerHeight > 0 ? (
              <div style={{ height: headerSpacerHeight }} aria-hidden="true" />
            ) : null
          ) : (
            header ?? (
              <Reveal className="mb-8 max-w-2xl">
                <p className="eyebrow">{t('wireTitle')}</p>
                <h2 className="mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl">
                  {t('wireBlurb')}
                </h2>
                <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">{t('wireHint')}</p>
              </Reveal>
            )
          )}
          <FeedStream embedded />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Reveal className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <h3 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              {t('wireStatus')}
            </h3>
            <ul className="mt-3 divide-y divide-border/60">
              {[
                { label: t('publicPosts'), value: snapshot.postCount },
                { label: t('authors'), value: snapshot.activeAuthors },
                { label: t('topicTags'), value: snapshot.topics.length },
                { label: t('engagements'), value: snapshot.likeCount + snapshot.commentCount },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-display text-lg font-medium tabular-nums text-foreground">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.06} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
            <h3 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              {t('takeFurther')}
            </h3>
            <ul className="mt-3 space-y-0.5">
              {[
                { href: '/academy', label: 'Academy pathways' },
                { href: '/products', label: 'Tool crib' },
                { href: '/events', label: 'Shop events' },
                { href: '/feed?scope=following', label: 'Your following feed' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group -mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/70"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 -translate-x-1 text-primary opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
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
