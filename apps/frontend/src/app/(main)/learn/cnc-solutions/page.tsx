import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { LEARN_CNC_SOLUTIONS } from '@/lib/learn-content';
import { LearnArticlePage } from '@/components/learn/learn-article-page';

export const metadata: Metadata = createPageMetadata(
  LEARN_CNC_SOLUTIONS.title,
  LEARN_CNC_SOLUTIONS.description,
  LEARN_CNC_SOLUTIONS.path,
);

export default function Page() {
  return <LearnArticlePage article={LEARN_CNC_SOLUTIONS} />;
}
