'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Crown, Eye, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { GroupCard } from '@/components/groups/group-card';
import { apiErrorMessage, groupsApi, type MyGroup } from '@/lib/groups-api';
import { useAuthStore } from '@/stores/auth-store';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { transition } from '@/lib/motion';

export default function MyGroupsPage() {
  const t = useTranslations('pages.groups');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login?returnUrl=/groups/mine');
    }
  }, [hydrated, isAuthenticated, router]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['study-groups', 'mine'],
    queryFn: () => groupsApi.mine(),
    enabled: isAuthenticated && hydrated,
    retry: 1,
  });

  const leave = useMutation({
    mutationFn: (groupId: string) => groupsApi.leave(groupId),
    onSuccess: () => {
      toast({ type: 'ok', title: t('left') });
      setPendingLeave(null);
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
    },
    onError: (err) => {
      setPendingLeave(null);
      toast({ type: 'err', title: apiErrorMessage(err, t('leaveFailed')) });
    },
  });

  if (!hydrated || !isAuthenticated) return null;

  const groups: MyGroup[] = data?.data ?? [];

  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">
            {t('myGroupsTitle')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('myGroupsHint')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/groups">{t('backToGroups')}</Link>
          </Button>
          <Button asChild>
            <Link href="/groups/new">{t('startGroup')}</Link>
          </Button>
        </div>
      </Reveal>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      )}

      {error && <ErrorState title={t('loadFailed')} onRetry={() => refetch()} />}

      {!isLoading && !error && groups.length === 0 && (
        <EmptyState
          icon={Users}
          title={t('myGroupsEmpty')}
          description={t('myGroupsEmptyHint')}
          action={
            <Button asChild>
              <Link href="/groups">{t('browseGroups')}</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !error && groups.length > 0 && (
        <Stagger as="ul" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <StaggerItem as="li" key={g.id} index={i} className="flex flex-col gap-3">
              <GroupCard group={g} className="flex-1" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={g.isHost ? 'soft' : 'soft-muted'} className="me-auto">
                  {g.isHost && <Crown className="me-1 size-3" aria-hidden="true" />}
                  {g.isHost ? t('hostRole') : t('memberRole')}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/groups/${g.id}`}>
                    <Eye className="me-1.5 size-3.5" aria-hidden="true" />
                    {t('view')}
                  </Link>
                </Button>
                <AnimatePresence mode="wait" initial={false}>
                {pendingLeave === g.id ? (
                  <m.div
                    key="confirm"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0, transition: transition.enter }}
                    exit={{ opacity: 0, x: 8, transition: transition.leave }}
                  >
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => leave.mutate(g.id)}
                      disabled={leave.isPending}
                    >
                      {t('leaveYes')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPendingLeave(null)}>
                      {tCommon('cancel')}
                    </Button>
                  </m.div>
                ) : (
                  <m.div
                    key="leave"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: transition.enter }}
                    exit={{ opacity: 0, transition: transition.leave }}
                  >
                    <Button variant="outline" size="sm" onClick={() => setPendingLeave(g.id)}>
                      <UserMinus className="me-1.5 size-3.5" aria-hidden="true" />
                      {t('leave')}
                    </Button>
                  </m.div>
                )}
                </AnimatePresence>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
