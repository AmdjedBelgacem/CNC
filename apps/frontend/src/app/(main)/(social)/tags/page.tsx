import { pageMeta } from '@/lib/page-title';
import { TagIndex } from '@/components/feed/tag-views';

export const generateMetadata = pageMeta('tags');

export default function TagsPage() {
  return <TagIndex />;
}
