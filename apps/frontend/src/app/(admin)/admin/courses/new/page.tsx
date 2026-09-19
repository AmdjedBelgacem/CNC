'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import * as api from '../studio/api';
export default function NewCoursePage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const slug = 'course-' + Date.now().toString(36);
        const created = await api.createDraft({ slug, title: 'Untitled course' });
        if (cancelled) return;
        router.replace(`/admin/courses/${created.slug}/edit`);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || 'Failed to create course');
        toast({ type: 'err', title: 'Create failed', description: e?.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        {' '}
        <p className="font-sans text-base text-foreground">{err}</p>{' '}
        <button
          type="button"
          onClick={() => router.push('/admin/courses')}
          className="rounded-lg bg-accent px-4 py-2 font-sans text-sm font-medium text-white"
        >
          {' '}
          Back to courses{' '}
        </button>{' '}
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      {' '}
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />{' '}
    </div>
  );
}
