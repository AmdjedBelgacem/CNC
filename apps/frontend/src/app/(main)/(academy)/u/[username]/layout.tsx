import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { fetchProfileByHandle } from '@/lib/profile';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

/**
 * The page is a client component, so it cannot name itself: `/u/<handle>` carried the
 * site-wide homepage title in the tab and in history. This mirrors the id-based profile route.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [cookieStore, headerList, locale] = await Promise.all([cookies(), headers(), getLocale()]);
  const viewer = {
    tenantSlug: cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG,
    cookie: headerList.get('cookie') ?? undefined,
    locale,
  };
  const profile = await fetchProfileByHandle(username, viewer);
  // An unknown (or private) handle must not get a title made from whatever was typed in the URL,
  // nor be indexed under it.
  if (!profile) return { title: 'Profile', robots: { index: false, follow: false } };
  const name = profile.name?.trim() || profile.username || 'Profile';
  return { title: `${name} · Profile` };
}

export default function UsernameProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
