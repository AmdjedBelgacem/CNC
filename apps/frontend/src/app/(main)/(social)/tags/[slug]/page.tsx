import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TagView } from '@/components/feed/tag-views';

/** Names the page after its tag (it was just "Tag" for every one), still localized. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('pageMeta');
  return { title: `#${decodeURIComponent(slug)} · ${t('tag.title')}`, description: t('tag.description') };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TagView slug={slug} />;
}
