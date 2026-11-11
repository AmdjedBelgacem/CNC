import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { brandedTitle } from '@/lib/page-title';

/** The search page is a client component, so the title comes from here. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');
  return brandedTitle(t('title'));
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
