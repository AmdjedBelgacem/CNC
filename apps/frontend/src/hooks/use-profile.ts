'use client';
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth-store';
import type {
  FeedPost,
  ProfileConnection,
  ProfileLearningRecord,
} from '@/lib/api/types';

export interface FollowSuggestion {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  followerCount: number;
  mutualCount: number;
  isFollowing: boolean;
}

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => ['profile', 'detail', userId] as const,
  posts: (userId: string) => ['profile', 'posts', userId] as const,
  learning: (userId: string) => ['profile', 'learning', userId] as const,
  connections: (userId: string, kind: string) => ['profile', 'connections', userId, kind] as const,
  suggestions: ['profile', 'suggestions'] as const,
};

/** Paginated public posts for a profile. */
export function useProfilePosts(userId: string | null, page = 1) {
  return useQuery({
    queryKey: profileKeys.posts(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch(`/api/proxy/social/profile/${userId}/posts?page=${page}&limit=6`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { data: FeedPost[]; total: number; page: number };
      // This endpoint nests the author under `user`; `PostCard` reads `author`.
      return {
        ...payload,
        data: payload.data,
      };
    },
  });
}

/** Enrollments + certificates. Loaded on demand for the Learning tab. */
export function useProfileLearning(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: profileKeys.learning(userId ?? ''),
    enabled: !!userId && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/proxy/social/profile/${userId}/courses`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ProfileLearningRecord;
    },
  });
}

/**
 * Followers / following, loaded when the connections dialog opens. The server
 * returns `isFollowing` per row so the list renders Follow/Following in one
 * request; local overrides keep the row honest right after a click.
 */
export function useProfileConnections(
  userId: string | null,
  kind: 'followers' | 'following' | null,
) {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: profileKeys.connections(userId ?? '', kind ?? 'followers'),
    enabled: !!userId && !!kind,
    queryFn: async () => {
      const res = await fetch(
        `/api/proxy/social/profile/${userId}/connections?kind=${kind}&limit=36`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as {
        data: (ProfileConnection & { isFollowing?: boolean })[];
        total: number;
      };
    },
  });

  const markChanged = useCallback(
    (targetId: string, following: boolean) => {
      setOverrides((current) => ({ ...current, [targetId]: following }));
      // Counts and the opposite list both live behind the profile.
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId ?? '') });
      void queryClient.invalidateQueries({ queryKey: profileKeys.suggestions });
    },
    [queryClient, userId],
  );

  return {
    ...query,
    connections: (query.data?.data ?? []).map((row) => ({
      ...row,
      isFollowing: overrides[row.id] ?? !!row.isFollowing,
    })),
    markChanged,
  };
}

/** Members the signed-in viewer may want to follow. */
export function useFollowSuggestions(enabled: boolean) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: profileKeys.suggestions,
    enabled,
    queryFn: async () => {
      const res = await fetch('/api/proxy/social/suggestions?limit=6', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as FollowSuggestion[];
    },
  });

  const markChanged = useCallback((targetId: string, following: boolean) => {
    setOverrides((current) => ({ ...current, [targetId]: following }));
  }, []);

  return {
    ...query,
    suggestions: (query.data ?? []).map((row) => ({
      ...row,
      isFollowing: overrides[row.id] ?? row.isFollowing,
    })),
    markChanged,
  };
}

/**
 * Follow / unfollow for the profile header, with the follower count patched in
 * place (the header is server rendered, so a refetch would flash).
 */
export function useFollowToggle() {
  const t = useTranslations('profile');
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const mutation = useMutation({
    mutationFn: async ({ userId, following }: { userId: string; following: boolean }) => {
      const res = await fetch(`/api/proxy/social/follow/${userId}`, {
        method: following ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      return !following;
    },
    onMutate: async ({ userId, following }) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.detail(userId) });
      const previous = queryClient.getQueryData<{ stats: { followers: number }; isFollowing: boolean }>(
        profileKeys.detail(userId),
      );
      queryClient.setQueryData(
        profileKeys.detail(userId),
        (old: { stats: { followers: number }; isFollowing: boolean } | undefined) =>
          old
            ? {
                ...old,
                isFollowing: !following,
                stats: {
                  ...old.stats,
                  followers: Math.max(0, old.stats.followers + (following ? -1 : 1)),
                },
              }
            : old,
      );
      return { previous, userId };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileKeys.detail(context.userId), context.previous);
      }
      toast({ type: 'err', title: error instanceof Error ? error.message : t('followFailed') });
    },
    onSuccess: (following) => {
      toast({ type: 'ok', title: following ? t('nowFollowing') : t('unfollowed') });
    },
    onSettled: (_data, _error, { userId }) => {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.suggestions });
    },
  });

  const toggle = useCallback(
    (userId: string, following: boolean) => {
      if (!isAuthenticated) {
        toast({ type: 'err', title: t('signInToFollow') });
        return;
      }
      setPending(true);
      mutation.mutate({ userId, following });
    },
    [isAuthenticated, mutation, t],
  );

  return { toggle, pending };
}
