import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';
import { LEARN_G_CODE_BASICS } from '@/lib/learn-content';
import { LearnArticlePage } from '@/components/learn/learn-article-page';

export const metadata: Metadata = createPageMetadata(
  LEARN_G_CODE_BASICS.title,
  LEARN_G_CODE_BASICS.description,
  LEARN_G_CODE_BASICS.path,
);

export default function Page() {
  return <LearnArticlePage article={LEARN_G_CODE_BASICS} />;
}
