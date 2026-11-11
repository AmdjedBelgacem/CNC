import { pageMeta } from '@/lib/page-title';
import { TagView } from '@/components/feed/tag-views';

export const generateMetadata = pageMeta('tag');

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TagView slug={slug} />;
}
