import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProfileView } from '@/components/profile/profile-view';
import { fetchProfile, fetchProfileLearning } from '@/lib/profile';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

type Params = { params: Promise<{ userId: string }> };

async function loadProfile(userId: string) {
  const [cookieStore, headerList, locale] = await Promise.all([
    cookies(),
    headers(),
    getLocale(),
  ]);
  const cookie = headerList.get('cookie') ?? undefined;
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const viewer = { tenantSlug, cookie, locale };
  const profile = await fetchProfile(userId, viewer);
  if (!profile) return null;
  // The learning record is secondary content: never fail the page over it.
  const learning = await fetchProfileLearning(userId, viewer);
  return { profile, learning };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { userId } = await params;
  const { profile } = (await loadProfile(userId)) ?? { profile: null };
  if (!profile) return { title: 'Profile not found' };

  const name = profile.name?.trim() || profile.username || 'Profile';
  const description =
    profile.headline ||
    profile.bio?.slice(0, 160) ||
    `${name} on TITANS of Manufacturing — courses, certificates and shop projects.`;
  const handle = profile.username ? `@${profile.username}` : name;

  return {
    title: `${name} · Profile`,
    description,
    alternates: { canonical: `/profile/${profile.id}` },
    openGraph: {
      type: 'profile',
      title: `${name} (${handle})`,
      description,
      url: `/profile/${profile.id}`,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: Params) {
  const { userId } = await params;
  const data = await loadProfile(userId);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-background">
      <ProfileView profile={data.profile} learning={data.learning} />
    </div>
  );
}
