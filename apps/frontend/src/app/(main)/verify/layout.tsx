import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { brandedTitle } from '@/lib/page-title';

/**
 * The verify index is a client component, so it cannot export metadata itself and was inheriting
 * the site-wide homepage title. `/verify/[number]` sets its own title, which overrides this one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verifyIndex');
  return brandedTitle(t('title'));
}

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return children;
}
