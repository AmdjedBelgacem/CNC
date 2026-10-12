'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';
import { GroupForm, GroupFormShell } from '@/components/groups/group-form';
import { apiErrorMessage, groupsApi, type CreateGroupInput } from '@/lib/groups-api';
import { useAuthStore } from '@/stores/auth-store';

export default function NewGroupPage() {
  const t = useTranslations('pages.groups');
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  // Cookie auth hydrates asynchronously; redirecting before it settles would bounce every
  // signed-in visitor to /login on a cold load.
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login?returnUrl=/groups/new');
    }
  }, [hydrated, isAuthenticated, router]);

  const create = useMutation({
    mutationFn: (input: CreateGroupInput) => groupsApi.create(input),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['study-groups'] });
      toast({ type: 'ok', title: t('created') });
      router.push(`/groups/${group.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, t('saveFailed'))),
  });

  if (!hydrated) return null;
  if (!isAuthenticated) return null;

  return (
    <GroupFormShell title={t('newTitle')}>
      <p className="mb-6 text-sm text-muted-foreground">{t('newHint')}</p>
      <GroupForm
        submitting={create.isPending}
        error={error}
        submitLabel={t('create')}
        onSubmit={async (input) => {
          setError(null);
          await create.mutateAsync(input);
        }}
        onCancel={() => router.push('/groups')}
      />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/groups" className="underline-offset-4 hover:underline">
          {t('backToGroups')}
        </Link>
      </p>
    </GroupFormShell>
  );
}
