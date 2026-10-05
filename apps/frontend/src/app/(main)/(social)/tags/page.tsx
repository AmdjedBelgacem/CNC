import type { Metadata } from 'next';
import { TagIndex } from '@/components/feed/tag-views';

export const metadata: Metadata = {
  title: 'Tags | Baroot CNC Solutions',
  description: 'Every topic the community is posting about.',
};

export default function TagsPage() {
  return <TagIndex />;
}
