'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { FeedComment, FeedPost, FeedTag } from '@/lib/api/types';

export type FeedScope = 'discover' | 'following';
export type FeedSort = 'hot' | 'new' | 'top';
export type CommentSort = 'best' | 'new' | 'old';

export const feedKeys = {
  all: ['feed'] as const,
  list: (scope: FeedScope = 'discover', sort: FeedSort = 'hot', tag?: string) =>
    [...feedKeys.all, scope, sort, tag ?? ''] as const,
  comments: (postId: string, sort: CommentSort = 'best') =>
    [...feedKeys.all, 'comments', postId, sort] as const,
  tags: ['feed', 'tags'] as const,
  tag: (slug: string, sort: FeedSort = 'hot') => [...feedKeys.all, 'tag', slug, sort] as const,
};

export function useFeed(
  scope: FeedScope = 'discover',
  enabled = true,
  options: { sort?: FeedSort; tag?: string } = {},
) {
  const sort = options.sort ?? 'hot';
  const query = useQuery({
    queryKey: feedKeys.list(scope, sort, options.tag),
    queryFn: async () => {
      const path =
        scope === 'following'
          ? '/feed/my'
          : `/feed?sort=${sort}${options.tag ? `&tag=${encodeURIComponent(options.tag)}` : ''}`;
      const payload = await api.get<{ data: FeedPost[] }>(path);
      return payload.data ?? [];
    },
    enabled,
  });
  return { ...query, posts: query.data ?? [] };
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; mediaUrls?: string[]; tags?: string[] }) =>
      api.post<FeedPost>('/feed', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

/**
 * Cast, switch or withdraw a vote.
 *
 * `value` is 1, -1 or 0 (withdraw). The cache is patched in place so the arrow
 * reacts instantly and a failure can be rolled back to the server's numbers.
 */
export function useVotePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, value }: { postId: string; value: number }) =>
      api.post<{ score: number; upvotes: number; downvotes: number; myVote: number }>(
        `/feed/${postId}/vote`,
        { value },
      ),
    onMutate: async ({ postId, value }) => {
      await qc.cancelQueries({ queryKey: feedKeys.all });
      const snapshots = qc.getQueriesData<{ data: FeedPost[] }>({ queryKey: feedKeys.all });
      qc.setQueriesData<{ data: FeedPost[] }>({ queryKey: feedKeys.all }, (existing) => {
        if (!existing?.data) return existing;
        return {
          ...existing,
          data: existing.data.map((post) => {
            if (post.id !== postId) return post;
            const previous = post.myVote ?? 0;
            // The same arithmetic the server does, so the number under the arrow
            // does not jump when the response lands.
            const score = post.score - previous + value;
            const upvotes = post.upvotes + (value === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
            const downvotes = post.downvotes + (value === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);
            return {
              ...post,
              score,
              upvotes: Math.max(0, upvotes),
              downvotes: Math.max(0, downvotes),
              voteCount: Math.max(0, upvotes) + Math.max(0, downvotes),
              myVote: value,
            };
          }),
        };
      });
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.delete(`/feed/${postId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

export function useComments(
  postId: string | null,
  enabled = true,
  sort: CommentSort = 'best',
) {
  const query = useQuery({
    queryKey: feedKeys.comments(postId ?? 'none', sort),
    queryFn: async () => {
      const payload = await api.get<{ data: FeedComment[] }>(`/feed/${postId}/comments?sort=${sort}`);
      return payload.data ?? [];
    },
    enabled: enabled && !!postId,
  });
  return { ...query, comments: query.data ?? [] };
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string | null }) =>
      api.post<FeedComment>(`/feed/${postId}/comments`, { content, parentId: parentId ?? null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      void qc.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

export function useVoteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: number }) =>
      api.post<{ score: number; myVote: number }>(`/feed/comments/${commentId}/vote`, { value }),
    onMutate: async ({ commentId, value }) => {
      await qc.cancelQueries({ queryKey: feedKeys.comments(postId) });
      const snapshots = qc.getQueriesData<FeedComment[]>({ queryKey: feedKeys.comments(postId) });
      const patch = (nodes: FeedComment[]): FeedComment[] =>
        nodes.map((node) =>
          node.id === commentId
            ? { ...node, score: node.score - (node.myVote ?? 0) + value, myVote: value }
            : { ...node, replies: patch(node.replies ?? []) },
        );
      qc.setQueriesData<FeedComment[]>({ queryKey: feedKeys.comments(postId) }, (existing) =>
        existing ? patch(existing) : existing,
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/feed/comments/${commentId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      void qc.invalidateQueries({ queryKey: feedKeys.all });
    },
  });
}

/** The tag index, most used first. Backs the filter bar and the tag pages. */
export function useFeedTags(enabled = true) {
  const query = useQuery({
    queryKey: feedKeys.tags,
    queryFn: async () => {
      const payload = await api.get<{ data: FeedTag[] }>('/feed/tags?limit=60');
      return payload.data ?? [];
    },
    enabled,
    staleTime: 60_000,
  });
  return { ...query, tags: query.data ?? [] };
}

export function useTagPage(slug: string | null, sort: FeedSort = 'hot') {
  return useQuery({
    queryKey: feedKeys.tag(slug ?? 'none', sort),
    queryFn: async () => {
      const payload = await api.get<{
        data: FeedTag & { description?: string | null; feed: { data: FeedPost[] } };
      }>(
        `/feed/tags/${encodeURIComponent(slug ?? '')}?sort=${sort}`,
      );
      return payload.data;
    },
    enabled: !!slug,
  });
}
