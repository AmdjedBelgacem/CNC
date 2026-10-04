import type {
  FeedPost,
  Profile,
  ProfileConnection,
  ProfileLearningRecord,
} from '@/lib/api/types';

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Server-side fetchers for the public profile page.
 *
 * `isFollowing` and `isSelf` depend on the viewer, so these always pass the
 * incoming cookie through and use `cache: 'no-store'` — an ISR cache would
 * leak one visitor's follow state to the next.
 */
export interface ProfileViewer {
  tenantSlug: string;
  cookie?: string;
  locale?: string;
}

function headers(viewer: ProfileViewer): HeadersInit {
  return {
    'x-tenant-slug': viewer.tenantSlug,
    ...(viewer.cookie ? { cookie: viewer.cookie } : {}),
    ...(viewer.locale
      ? {
          'x-locale': viewer.locale,
          'x-next-locale': viewer.locale,
          'accept-language': `${viewer.locale},en;q=0.8`,
        }
      : {}),
  };
}

async function getJson<T>(path: string, viewer: ProfileViewer): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: headers(viewer),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The profile, its stats and its portfolio. `null` when the user is not visible. */
export async function fetchProfile(userId: string, viewer: ProfileViewer): Promise<Profile | null> {
  return getJson<Profile>(`/social/profile/${encodeURIComponent(userId)}`, viewer);
}

/** Public posts, newest first. */
export async function fetchProfilePosts(
  userId: string,
  viewer: ProfileViewer,
  limit = 6,
): Promise<{ data: FeedPost[]; total: number }> {
  const result = await getJson<{ data: FeedPost[]; total: number }>(
    `/social/profile/${encodeURIComponent(userId)}/posts?limit=${limit}`,
    viewer,
  );
  const data = result?.data ?? [];
  return { data, total: result?.total ?? 0 };
}

/** Enrollments with progress, plus certificates earned. */
export async function fetchProfileLearning(
  userId: string,
  viewer: ProfileViewer,
): Promise<ProfileLearningRecord> {
  const result = await getJson<ProfileLearningRecord>(
    `/social/profile/${encodeURIComponent(userId)}/courses`,
    viewer,
  );
  return { enrollments: result?.enrollments ?? [], certificates: result?.certificates ?? [] };
}

/** Followers or following. */
export async function fetchConnections(
  userId: string,
  kind: 'followers' | 'following',
  viewer: ProfileViewer,
  limit = 24,
): Promise<{ data: ProfileConnection[]; total: number }> {
  const result = await getJson<{ data: ProfileConnection[]; total: number }>(
    `/social/profile/${encodeURIComponent(userId)}/connections?kind=${kind}&limit=${limit}`,
    viewer,
  );
  return { data: result?.data ?? [], total: result?.total ?? 0 };
}
