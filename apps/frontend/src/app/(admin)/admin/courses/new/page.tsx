'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import * as api from '../studio/api';
import { slugify } from '../studio/slugify';

interface AcademyOption {
  id: string;
  slug: string;
  title: string;
}

const templates = [
  {
    id: 'blank',
    name: 'Start from scratch',
    description: 'A clean course with a flexible curriculum.',
    icon: Sparkles,
    tone: 'from-primary/20 to-primary/5 text-primary',
  },
  {
    id: 'workshop',
    name: 'Workshop blueprint',
    description: 'A practical, lesson-first structure for makers.',
    icon: Wrench,
    tone: 'from-warning/20 to-warning/5 text-warning',
  },
  {
    id: 'academy',
    name: 'Academy pathway',
    description: 'A polished pathway for an academy catalog.',
    icon: GraduationCap,
    tone: 'from-info/20 to-info/5 text-info',
  },
] as const;

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [academyId, setAcademyId] = useState('');
  const [template, setTemplate] = useState<(typeof templates)[number]['id']>('blank');
  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [loadingAcademies, setLoadingAcademies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/proxy/admin/academies?limit=100', {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data?.items)) {
          setAcademies(
            data.items.map((item: AcademyOption) => ({
              id: item.id,
              slug: item.slug,
              title: item.title,
            })),
          );
        }
      } catch {
        if (!cancelled) setAcademies([]);
      } finally {
        if (!cancelled) setLoadingAcademies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSlug = useMemo(() => slugify(slug || title), [slug, title]);
  const canSubmit = title.trim().length > 1 && normalizedSlug.length > 1 && !submitting;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Add a course title to continue.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      setError('Use a lowercase URL slug made of letters, numbers, and hyphens.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createDraft({
        title: title.trim(),
        slug: normalizedSlug,
        academyId: academyId || undefined,
        metadata: template === 'blank' ? undefined : { template },
      });
      toast({ type: 'ok', title: 'Course draft created' });
      router.push(`/admin/courses/${created.slug}/edit?step=basics`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Could not create course';
      setError(message);
      toast({ type: 'err', title: 'Course creation failed', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <button
          type="button"
          onClick={() => router.push('/admin/courses')}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          Back to courses
        </button>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="size-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Course Studio</p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Create a course</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Start with the essentials. You can shape the curriculum, media, pricing, and publishing checklist in the studio.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <label htmlFor="course-title" className="text-sm font-semibold text-foreground">Course title <span className="text-destructive">*</span></label>
                <input
                  id="course-title"
                  autoFocus
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                  }}
                  placeholder="e.g. CNC Milling Fundamentals"
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <p className="text-xs text-muted-foreground">Use a clear promise learners can recognize in the catalog.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="course-slug" className="text-sm font-semibold text-foreground">URL slug <span className="text-destructive">*</span></label>
                <div className="flex h-12 items-center rounded-xl border border-input bg-background px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                  <span className="shrink-0 text-sm text-muted-foreground">/courses/</span>
                  <input
                    id="course-slug"
                    value={slugTouched ? slug : normalizedSlug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                    }}
                    className="min-w-0 flex-1 bg-transparent ps-1 font-mono text-sm text-foreground outline-none"
                    placeholder="cnc-milling-fundamentals"
                  />
                </div>
                <p className="text-xs text-muted-foreground">This becomes the public course address.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="course-academy" className="text-sm font-semibold text-foreground">Academy</label>
                <select
                  id="course-academy"
                  value={academyId}
                  onChange={(event) => setAcademyId(event.target.value)}
                  disabled={loadingAcademies}
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                >
                  <option value="">{loadingAcademies ? 'Loading academies…' : 'No academy — tenant library'}</option>
                  {academies.map((academy) => (
                    <option key={academy.id} value={academy.id}>{academy.title}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Assigning an academy makes this course available in its catalog after publishing.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Choose a starting point</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {templates.map((item) => {
                    const Icon = item.icon;
                    const active = template === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTemplate(item.id)}
                        className={cn(
                          'relative rounded-xl border p-4 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
                        )}
                      >
                        {active && <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                        <span className={cn('mb-3 flex size-9 items-center justify-center rounded-lg bg-gradient-to-br', item.tone)}><Icon className="size-4" /></span>
                        <span className="block text-sm font-semibold text-foreground">{item.name}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" className="mt-6 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => router.push('/admin/courses')} className="h-11 rounded-xl px-5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">Cancel</button>
              <button type="submit" disabled={!canSubmit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 rtl:rotate-180" />}
                {submitting ? 'Creating course…' : 'Create and open Studio'}
              </button>
            </div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">What happens next</p>
              <ol className="mt-5 space-y-5">
                {[
                  ['01', 'Basics', 'Name your course and choose its academy.'],
                  ['02', 'Curriculum', 'Shape sections, lessons, and rich learning blocks.'],
                  ['03', 'Publish', 'Review blockers, localize, and go live.'],
                ].map(([number, titleText, body]) => (
                  <li key={number} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-xs font-semibold text-primary">{number}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{titleText}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm text-primary">
              <p className="font-semibold">A guided flow, not a blank canvas.</p>
              <p className="mt-1 text-xs leading-relaxed text-primary/80">You can always change the template, reorder content, and add Arabic translations later.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
