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
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('myGroupsTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('myGroupsHint')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/groups">{t('backToGroups')}</Link>
          </Button>
          <Button asChild>
            <Link href="/groups/new">{t('startGroup')}</Link>
          </Button>
        </div>
      </div>

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
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g.id} className="flex flex-col gap-3">
              <GroupCard group={g} className="flex-1" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={g.isHost ? 'default' : 'secondary'} className="me-auto">
                  {g.isHost && <Crown className="me-1 size-3" aria-hidden="true" />}
                  {g.isHost ? t('hostRole') : t('memberRole')}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/groups/${g.id}`}>
                    <Eye className="me-1.5 size-3.5" aria-hidden="true" />
                    {t('view')}
                  </Link>
                </Button>
                {pendingLeave === g.id ? (
                  <>
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
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setPendingLeave(g.id)}>
                    <UserMinus className="me-1.5 size-3.5" aria-hidden="true" />
                    {t('leave')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
