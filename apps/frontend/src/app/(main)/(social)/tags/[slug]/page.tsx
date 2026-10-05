import type { Metadata } from 'next';
import { TagView } from '@/components/feed/tag-views';

export const metadata: Metadata = {
  title: 'Tag | Baroot CNC Solutions',
  description: 'Community posts filed under this tag.',
};

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TagView slug={slug} />;
}
