const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const REVALIDATE = 60;

export interface WirePost {
  id: string;
  content: string;
  /**
   * Normalized tag objects. A bare string is still accepted because this snapshot
   * is cached for a minute and may have been taken against an older payload.
   */
  tags?: Array<string | { slug?: string | null; label?: string | null }> | null;
  upvotes?: number | null;
  /** Legacy name for the upvote count. */
  likeCount?: number | null;
  commentCount?: number | null;
  createdAt?: string;
  author?: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    headline?: string | null;
  } | null;
  /** Legacy name for the author. */
  user?: { id: string; name?: string | null } | null;
}

export interface WireSnapshot {
  posts: WirePost[];
  postCount: number;
  likeCount: number;
  commentCount: number;
  topics: { tag: string; count: number }[];
  activeAuthors: number;
}

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
    if (!res.ok) return emptySnapshot();
    const json = await res.json();
    const posts: WirePost[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];

    const tagCounts = new Map<string, number>();
    let likeCount = 0;
    let commentCount = 0;
    const authors = new Set<string>();

    for (const p of posts) {
      // The feed reports upvotes and a score; the old `likeCount` is gone.
      likeCount += p.upvotes ?? p.likeCount ?? 0;
      commentCount += p.commentCount ?? 0;
      const authorId = p.author?.id ?? p.user?.id;
      if (authorId) authors.add(authorId);
      for (const raw of p.tags ?? []) {
        // Tags arrive as `{ slug, label }`. `String(raw)` on an object yields the
        // literal "[object Object]", which is exactly what this used to publish
        // as the topic index.
        const tag =
          typeof raw === 'string'
            ? raw.trim().toLowerCase()
            : String(raw?.slug ?? raw?.label ?? '')
                .trim()
                .toLowerCase();
        if (!tag) continue;
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const topics = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 12);

    return {
      posts,
      postCount: posts.length,
      likeCount,
      commentCount,
      topics,
      activeAuthors: authors.size,
    };
  } catch {
    return emptySnapshot();
  }
}

function emptySnapshot(): WireSnapshot {
  return {
    posts: [],
    postCount: 0,
    likeCount: 0,
    commentCount: 0,
    topics: [],
    activeAuthors: 0,
  };
}
