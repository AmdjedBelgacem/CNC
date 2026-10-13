import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { LEARN_WHAT_IS_CNC_MACHINING } from '@/lib/learn-content';
import { LearnArticlePage } from '@/components/learn/learn-article-page';

export const metadata: Metadata = createPageMetadata(
  LEARN_WHAT_IS_CNC_MACHINING.title,
  LEARN_WHAT_IS_CNC_MACHINING.description,
  LEARN_WHAT_IS_CNC_MACHINING.path,
);

export default function Page() {
  return <LearnArticlePage article={LEARN_WHAT_IS_CNC_MACHINING} />;
}
