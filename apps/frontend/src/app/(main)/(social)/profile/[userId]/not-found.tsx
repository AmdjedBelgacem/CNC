'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

// Client component: `EmptyState` is a Client Component and an icon is a
// function, so this boundary cannot be rendered on the server.
export default function ProfileNotFound() {
  const t = useTranslations('profile');

  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto w-full max-w-container-max py-20 md:py-28">
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <EmptyState
          icon={UserX}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href="/academy">{t('browseCourses')}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/feed">{t('goToCommunity')}</Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
