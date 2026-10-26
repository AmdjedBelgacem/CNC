import { serverApiUrl } from '@/lib/server-api-url';
import {
  buildWireSnapshot,
  emptyWireSnapshot,
  type WirePost,
  type WireSnapshot,
} from '@/lib/feed-snapshot';

const API_BASE = serverApiUrl();
const REVALIDATE = 60;

export type { WirePost, WireSnapshot };

/** Server-side snapshot of the public feed for shell stats + topic index. */
export async function fetchWireSnapshot(
  tenantSlug: string,
  limit = 50,
): Promise<WireSnapshot> {
  try {
    const res = await fetch(`${API_BASE}/feed?limit=${limit}`, {
      headers: { 'x-tenant-slug': tenantSlug },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return emptyWireSnapshot();
    const json = await res.json();
    const posts: WirePost[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];
    return buildWireSnapshot(posts);
  } catch {
    return emptyWireSnapshot();
  }
}
