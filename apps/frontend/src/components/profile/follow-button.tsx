'use client';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserCheck, UserPlus } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

type FollowState = { following: boolean; pending?: boolean };

/**
 * Follow / unfollow with optimistic state and rollback.
 *
 * Owns one boolean per target id so a list of people can render many buttons
 * without them fighting over a single "pending" flag. The parent's state is
 * updated through `onChange` so the surrounding list stays in sync.
 */
export function useFollowToggle(onChanged?: (targetId: string, following: boolean) => void) {
  const t = useTranslations('profile');
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const set = (targetId: string, following: boolean) => {
    setPending((current) => ({ ...current, [targetId]: following }));
  };
  const clear = (targetId: string) => {
    setPending((current) => {
      if (!(targetId in current)) return current;
      const next = { ...current };
      delete next[targetId];
      return next;
    });
  };
  const isPending = (targetId: string) => !!pending[targetId];

  const mutate = useCallback(
    async (targetId: string, following: boolean) => {
      if (!isAuthenticated) {
        router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      set(targetId, following);
      try {
        const res = await fetch(`/api/proxy/social/follow/${targetId}`, {
          method: following ? 'DELETE' : 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? t('followFailed'));
        }
        onChanged?.(targetId, !following);
        toast({ type: 'ok', title: !following ? t('nowFollowing') : t('unfollowed') });
      } catch (error) {
        set(targetId, following); // roll back the optimistic state
        toast({
          type: 'err',
          title: error instanceof Error ? error.message : t('followFailed'),
        });
      } finally {
        // Must always clear: a stuck `pending` leaves the button disabled and
        // the second click (unfollow after follow) silently does nothing.
        clear(targetId);
      }
    },
    [clear, isAuthenticated, onChanged, router, set, t],
  );

  return { toggle: mutate, isPending };
}

export function FollowButton({
  targetId,
  state,
  onChanged,
  size = 'sm',
  variant,
  className,
  showLabel = true,
}: {
  targetId: string;
  state: FollowState;
  onChanged?: (targetId: string, following: boolean) => void;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  showLabel?: boolean;
}) {
  const t = useTranslations('profile');
  const { toggle, isPending } = useFollowToggle(onChanged);
  const viewerId = useAuthStore((s) => s.user?.id);
  const following = state.following;
  const busy = isPending(targetId) || state.pending;

  // Belt and braces: a member can never follow themselves, so this control is
  // never rendered for the viewer's own id — not even from a new call site.
  if (viewerId && viewerId === targetId) return null;

  return (
    <Button
      size={size}
      variant={variant ?? (following ? 'outline' : 'default')}
      className={className}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? `${t('unfollow')}: ${t('thisMember')}` : `${t('follow')}: ${t('thisMember')}`}
      onClick={(event) => {
        // Rows are wrapped in links; a follow click must not navigate.
        event.preventDefault();
        event.stopPropagation();
        void toggle(targetId, following);
      }}
    >
      {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
      {showLabel && <span>{following ? t('following') : t('follow')}</span>}
    </Button>
  );
}
