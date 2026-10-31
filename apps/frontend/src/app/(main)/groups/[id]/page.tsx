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
import { AnimatePresence, m } from 'framer-motion';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
import { spring, transition } from '@/lib/motion';

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
      <div className="container mx-auto max-w-5xl space-y-4 px-4 py-10" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-56 w-full rounded-2xl" />
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
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ms-2 text-muted-foreground hover:text-foreground">
        <Link href="/groups">
          <ArrowLeft className="flip-rtl me-2 size-4" aria-hidden="true" />
          {t('backToGroups')}
        </Link>
      </Button>

      <AnimatePresence initial={false}>
        {!group.isActive && (
          <m.p
            key="archived"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16, transition: spring.layout }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, transition: transition.leave }}
            className="overflow-hidden rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            {t('archivedNotice')}
          </m.p>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
        <div className="h-44 w-full bg-gradient-to-br from-primary/15 via-muted to-accent/10 sm:h-56">
          {group.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.coverUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {group.academy && <Badge variant="soft-muted" className="capitalize">{group.academy}</Badge>}
                {!group.isActive && <Badge variant="outline">{t('archived')}</Badge>}
                {full && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">{t('full')}</Badge>}
              </div>
              <h1 className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-4xl">{group.name}</h1>
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

          <dl className="mt-8 grid gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-3 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground shadow-xs"><MapPin className="size-4" aria-hidden="true" /></span>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t('locationLabel')}</dt>
                <dd className="mt-0.5 text-sm text-foreground">{location || t('noLocation')}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground shadow-xs"><CalendarDays className="size-4" aria-hidden="true" /></span>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t('scheduleLabel')}</dt>
                <dd className="mt-0.5 text-sm text-foreground">{group.meetingSchedule || t('noSchedule')}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground shadow-xs"><Users className="size-4" aria-hidden="true" /></span>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t('capacityLabel')}</dt>
                <dd className="mt-0.5 text-sm tabular-nums text-foreground" aria-live="polite">
                  {t('memberCount', { count: group.memberCount, max: group.maxMembers ?? 0 })}
                </dd>
              </div>
            </div>
          </dl>

          {group.description && (
            <div className="mt-8 border-t border-border/60 pt-6">
              <h2 className="mb-3 font-display text-xl font-medium tracking-[-0.015em] text-foreground">{t('aboutLabel')}</h2>
              <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                {group.description}
              </p>
            </div>
          )}

          {group.address && (
            <p className="mt-4 text-sm text-muted-foreground">{group.address}</p>
          )}
        </div>
      </div>

      <Reveal as="section" className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-xs sm:p-8" aria-labelledby="members-heading">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="members-heading" className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('membersHeading')}
          </h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {t('memberCount', { count: group.memberCount, max: group.maxMembers ?? 0 })}
          </span>
        </div>

        {group.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noMembers')}</p>
        ) : (
          <Stagger as="ul" inViewOnly className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((member, i) => (
              <StaggerItem
                as="li"
                key={member.userId}
                index={i}
                className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                  aria-hidden="true"
                >
                  {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{member.name || member.username || t('member')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.role === 'host' ? t('hostRole') : t('memberRole')}
                  </span>
                </span>
                {member.role === 'host' && <Crown className="size-4 shrink-0 text-warning" aria-hidden="true" />}
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {group.memberCount > group.members.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('showingFirst', { shown: group.members.length, total: group.memberCount })}
          </p>
        )}
      </Reveal>

      {group.canManage && (
        <section className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-6 sm:p-8" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="font-display text-xl font-medium tracking-[-0.015em] text-foreground">
            {t('dangerZone')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('deleteHint')}</p>
          <AnimatePresence mode="wait" initial={false}>
          {confirmingDelete ? (
            <m.div
              key="confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: transition.enter }}
              exit={{ opacity: 0, y: -4, transition: transition.leave }}
              className="mt-4 flex flex-wrap items-center gap-3"
            >
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
            </m.div>
          ) : (
            <m.div
              key="ask"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: transition.enter }}
              exit={{ opacity: 0, transition: transition.leave }}
            >
              <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="me-2 size-4" aria-hidden="true" />
                {t('delete')}
              </Button>
            </m.div>
          )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
