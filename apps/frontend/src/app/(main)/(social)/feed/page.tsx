import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeBuilder } from '@/components/home/home-builder';
import { FeedTicker, FeedTopics, FeedWire, feedHeroStats } from '@/components/feed/feed-islands';
import { fetchWireSnapshot } from '@/lib/feed';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Community Feed',
  description:
    'Post setups, ask questions, and learn from machinists worldwide — the community feed where shop knowledge gets shared.',
  alternates: { canonical: '/feed' },
  openGraph: {
    title: 'Community Feed | Baroot CNC Solutions',
    description: 'Real machinists posting real setups — join the conversation.',
    type: 'website',
    url: '/feed',
  },
};

export default async function FeedPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const [layout, snapshot] = await Promise.all([
    resolvePageLayout(tenantSlug, 'feed'),
    fetchWireSnapshot(tenantSlug),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    name: 'Community Feed',
    description:
      'Post setups, ask questions, and learn from machinists worldwide — shop knowledge shared in public.',
    url: '/feed',
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: snapshot.likeCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: snapshot.commentCount,
      },
    ],
    keywords: snapshot.topics.map((t) => t.tag).join(', ') || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <HomeBuilder
        layout={layout}
        heroStats={feedHeroStats(snapshot)}
        islands={{
          'feed-ticker': <FeedTicker snapshot={snapshot} />,
          'feed-topics': <FeedTopics snapshot={snapshot} />,
          'feed-wire': <FeedWire snapshot={snapshot} />,
        }}
      />
    </>
  );
}
