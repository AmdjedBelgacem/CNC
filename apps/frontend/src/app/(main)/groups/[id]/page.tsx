'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  MapPin,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { apiErrorMessage, groupsApi } from '@/lib/groups-api';
import { useAuthStore } from '@/stores/auth-store';

export default function GroupDetailPage() {
  const t = useTranslations('pages.groups');
  const tCommon = useTranslations('common');
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['study-groups', 'detail', id],
    queryFn: () => groupsApi.detail(id!),
    enabled: !!id,
    retry: (count, err) => {
      const status = (err as { status?: number } | undefined)?.status;
      return status === 400 || status === 404 ? false : count < 1;
    },
  });

  const group = data?.data;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['study-groups'] });
  }

  const join = useMutation({
    mutationFn: () => groupsApi.join(id!),
    onSuccess: () => {
      toast({ type: 'ok', title: t('joined') });
      invalidate();
    },
    onError: (err) => toast({ type: 'err', title: apiErrorMessage(err, t('joinFailed')) }),
  });

  const leave = useMutation({
    mutationFn: () => groupsApi.leave(id!),
    onSuccess: () => {
      toast({ type: 'ok', title: t('left') });
      invalidate();
    },
    onError: (err) => toast({ type: 'err', title: apiErrorMessage(err, t('leaveFailed')) }),
  });

  const archive = useMutation({
    mutationFn: (nextActive: boolean) => groupsApi.update(id!, { isActive: nextActive }),
    onSuccess: () => {
      toast({ type: 'ok', title: t('saved') });
      invalidate();
    },
    onError: (err) => toast({ type: 'err', title: apiErrorMessage(err, t('saveFailed')) }),
  });

  const remove = useMutation({
    mutationFn: () => groupsApi.remove(id!),
    onSuccess: () => {
      toast({ type: 'ok', title: t('deleted') });
      invalidate();
      router.push('/groups');
    },
    onError: (err) => {
      setConfirmingDelete(false);
      toast({ type: 'err', title: apiErrorMessage(err, t('deleteFailed')) });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-10" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !group) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404 || status === 400) {
      return (
        <div className="container mx-auto px-4 py-16">
          <EmptyState
            icon={MapPin}
            title={t('notFound')}
            description={t('notFoundHint')}
            action={
              <Button asChild>
                <Link href="/groups">{t('backToGroups')}</Link>
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-16">
        <ErrorState title={t('loadFailed')} onRetry={() => refetch()} />
      </div>
    );
  }

  const location = [group.city, group.state].filter(Boolean).join(', ');
  const full = group.isFull;
  const canJoin = isAuthenticated && !group.isMember && group.isActive && !full;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ms-2">
        <Link href="/groups">
          <ArrowLeft className="flip-rtl me-2 size-4" aria-hidden="true" />
          {t('backToGroups')}
        </Link>
      </Button>

      {!group.isActive && (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t('archivedNotice')}
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl border bg-card">
        <div className="h-44 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
          {group.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.coverUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {group.academy && <Badge variant="secondary">{group.academy}</Badge>}
                {!group.isActive && <Badge variant="outline">{t('archived')}</Badge>}
                {full && <Badge variant="outline">{t('full')}</Badge>}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canJoin && (
                <Button onClick={() => join.mutate()} disabled={join.isPending}>
                  <UserPlus className="me-2 size-4" aria-hidden="true" />
                  {t('join')}
                </Button>
              )}
              {group.isMember && isAuthenticated && (
                <Button
                  variant="outline"
                  onClick={() => leave.mutate()}
                  disabled={leave.isPending}
                >
                  <UserMinus className="me-2 size-4" aria-hidden="true" />
                  {t('leave')}
                </Button>
              )}
              {!isAuthenticated && (
                <Button asChild>
                  <Link href={`/login?returnUrl=/groups/${id}`}>{t('signInToJoin')}</Link>
                </Button>
              )}
              {group.canManage && (
                <>
                  <Button asChild variant="outline">
                    <Link href={`/groups/${id}/edit`}>
                      <Pencil className="me-2 size-4" aria-hidden="true" />
                      {t('edit')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => archive.mutate(!group.isActive)}
                    disabled={archive.isPending}
                  >
                    {group.isActive ? (
                      <>
                        <Archive className="me-2 size-4" aria-hidden="true" />
                        {t('archive')}
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="me-2 size-4" aria-hidden="true" />
                        {t('unarchive')}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('locationLabel')}</dt>
                <dd className="text-sm">{location || t('noLocation')}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('scheduleLabel')}</dt>
                <dd className="text-sm">{group.meetingSchedule || t('noSchedule')}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('capacityLabel')}</dt>
                <dd className="text-sm" aria-live="polite">
                  {t('memberCount', { count: group.memberCount, max: group.maxMembers ?? 0 })}
                </dd>
              </div>
            </div>
          </dl>

          {group.description && (
            <div className="mt-6 border-t pt-6">
              <h2 className="mb-2 text-lg font-semibold">{t('aboutLabel')}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {group.description}
              </p>
            </div>
          )}

          {group.address && (
            <p className="mt-4 text-sm text-muted-foreground">{group.address}</p>
          )}
        </div>
      </div>

      <section className="mt-8 rounded-xl border bg-card p-6" aria-labelledby="members-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="members-heading" className="text-lg font-semibold">
            {t('membersHeading')}
          </h2>
          <span className="text-sm text-muted-foreground">
            {t('memberCount', { count: group.memberCount, max: group.maxMembers ?? 0 })}
          </span>
        </div>

        {group.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noMembers')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 rounded-lg border p-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {(m.name || m.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.name || m.username || t('member')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {m.role === 'host' ? t('hostRole') : t('memberRole')}
                  </span>
                </span>
                {m.role === 'host' && <Crown className="size-4 shrink-0 text-amber-500" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
        {group.memberCount > group.members.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('showingFirst', { shown: group.members.length, total: group.memberCount })}
          </p>
        )}
      </section>

      {group.canManage && (
        <section className="mt-8 rounded-xl border border-destructive/30 bg-card p-6" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-lg font-semibold">
            {t('dangerZone')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('deleteHint')}</p>
          {confirmingDelete ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium">{t('deleteConfirm')}</p>
              <Button
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 className="me-2 size-4" aria-hidden="true" />
                {t('deleteYes')}
              </Button>
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                {tCommon('cancel')}
              </Button>
            </div>
          ) : (
            <Button variant="destructive" className="mt-4" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="me-2 size-4" aria-hidden="true" />
              {t('delete')}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
