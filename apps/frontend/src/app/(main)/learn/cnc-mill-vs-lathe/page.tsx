import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { LEARN_CNC_MILL_VS_LATHE } from '@/lib/learn-content';
import { LearnArticlePage } from '@/components/learn/learn-article-page';

export const metadata: Metadata = createPageMetadata(
  LEARN_CNC_MILL_VS_LATHE.title,
  LEARN_CNC_MILL_VS_LATHE.description,
  LEARN_CNC_MILL_VS_LATHE.path,
);

export default function Page() {
  return <LearnArticlePage article={LEARN_CNC_MILL_VS_LATHE} />;
}
