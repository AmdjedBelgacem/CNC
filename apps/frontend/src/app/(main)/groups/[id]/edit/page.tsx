'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toast } from '@/components/ui/toast';
import { GroupForm, GroupFormShell } from '@/components/groups/group-form';
import { apiErrorMessage, groupsApi, type CreateGroupInput } from '@/lib/groups-api';
import { useAuthStore } from '@/stores/auth-store';

export default function EditGroupPage() {
  const t = useTranslations('pages.groups');
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?returnUrl=/groups/${id}/edit`);
    }
  }, [hydrated, isAuthenticated, id, router]);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['study-groups', 'detail', id],
    queryFn: () => groupsApi.detail(id!),
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const group = data?.data;

  const save = useMutation({
    mutationFn: (input: CreateGroupInput) => groupsApi.update(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      toast({ type: 'ok', title: t('saved') });
      router.push(`/groups/${id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, t('saveFailed'))),
  });

  if (!hydrated || !isAuthenticated) return null;

  if (isLoading) {
    return (
      <GroupFormShell title={t('editTitle')}>
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </GroupFormShell>
    );
  }

  if (loadError || !group) {
    const status = (loadError as { status?: number } | null)?.status;
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        {status === 404 || status === 400 ? (
          <EmptyState title={t('notFound')} description={t('notFoundHint')} />
        ) : (
          <ErrorState title={t('loadFailed')} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  // Server-side authorization is the real gate (the API answers 403); this just avoids rendering
  // a form whose submit button cannot possibly succeed.
  if (!group.canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title={t('notAllowed')} description={t('notAllowedHint')} />
      </div>
    );
  }

  return (
    <GroupFormShell title={t('editTitle')}>
      <GroupForm
        initial={group}
        submitting={save.isPending}
        error={error}
        submitLabel={t('save')}
        onSubmit={async (input) => {
          setError(null);
          await save.mutateAsync(input);
        }}
        onCancel={() => router.push(`/groups/${id}`)}
      />
    </GroupFormShell>
  );
}
