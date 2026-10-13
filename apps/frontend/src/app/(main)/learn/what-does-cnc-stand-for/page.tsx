import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { LEARN_WHAT_DOES_CNC_STAND_FOR } from '@/lib/learn-content';
import { LearnArticlePage } from '@/components/learn/learn-article-page';

export const metadata: Metadata = createPageMetadata(
  LEARN_WHAT_DOES_CNC_STAND_FOR.title,
  LEARN_WHAT_DOES_CNC_STAND_FOR.description,
  LEARN_WHAT_DOES_CNC_STAND_FOR.path,
);

export default function Page() {
  return <LearnArticlePage article={LEARN_WHAT_DOES_CNC_STAND_FOR} />;
}
