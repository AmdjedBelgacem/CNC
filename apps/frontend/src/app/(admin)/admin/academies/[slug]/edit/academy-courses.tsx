'use client';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { BookOpen, Clock, ExternalLink, GraduationCap, Loader2, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { spring, transition } from '@/lib/motion';
import { difficultyFallback, difficultyKey, difficultyTone } from '@/lib/difficulty';
import { toast } from '@/components/ui/toast';
import { StatusPill } from '@/components/admin/admin-ui';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';

export interface RosterCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  difficulty: number | null;
  estimatedHours: number | null;
  isPublished: boolean;
  isArchived: boolean;
  sortOrder: number | null;
  updatedAt: string;
}

interface CourseOption {
  id: string;
  slug: string;
  title: string;
  academyId?: string | null;
}

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/** Every course in the tenant, loaded the first time the editor asks for it. */
function useCourseOptions() {
  const tAdmin = useTranslations('admin');
  const [options, setOptions] = useState<CourseOption[] | null>(null);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (!wanted || options !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithRefresh('/api/proxy/admin/courses?limit=100', { credentials: 'include' });
        if (!res.ok) throw new Error(tAdmin('drawer.requestFailed', { status: res.status }));
        const data: { items?: CourseOption[] } = await res.json();
        if (!cancelled) setOptions(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wanted, options, tAdmin]);
  const request = useCallback(() => setWanted(true), []);
  return { options, request };
}

function matches(course: CourseOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return course.title.toLowerCase().includes(q) || course.slug.toLowerCase().includes(q);
}

/**
 * The academy's roster, in the order learners see it (each course's sort
 * order). Adding assigns (or moves) a course through
 * `POST /admin/academies/:slug/courses`; removing unassigns it through the
 * course PATCH (`academyId: null`) and never deletes course data.
 */
export function AcademyCourses({
  academySlug,
  academyId,
  academyTitle,
  courses,
  onChanged,
}: {
  academySlug: string;
  academyId: string;
  academyTitle: string;
  courses: RosterCourse[];
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const tAdmin = useTranslations('admin');
  const searchId = useId();
  const { options, request } = useCourseOptions();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [assigning, setAssigning] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rosterSlugs = useMemo(() => new Set(courses.map((c) => c.slug)), [courses]);
  const available = useMemo(
    () => (options ?? []).filter((c) => !rosterSlugs.has(c.slug)),
    [options, rosterSlugs],
  );
  const suggestions = available.filter((c) => matches(c, query)).slice(0, 6);
  const showSuggestions = focused || query.trim().length > 0;

  const assign = async (slugs: string[]) => {
    if (!slugs.length) return false;
    setAssigning(slugs);
    try {
      const data = await api.post<{ assigned: number }>(`/admin/academies/${academySlug}/courses`, {
        courseSlugs: slugs,
      });
      toast({ type: 'ok', title: t('coursesAdded', { count: data?.assigned ?? slugs.length }) });
      setQuery('');
      await onChanged();
      return true;
    } catch (error) {
      toast({ type: 'err', title: t('assignFailed'), description: messageOf(error) });
      return false;
    } finally {
      setAssigning(null);
    }
  };

  const remove = async (courseSlug: string) => {
    setRemoving(courseSlug);
    try {
      await api.patch(`/admin/courses/${courseSlug}`, { academyId: null });
      toast({ type: 'ok', title: t('courseRemoved') });
      await onChanged();
    } catch (error) {
      toast({ type: 'err', title: t('courseRemoveFailed'), description: messageOf(error) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-background px-4 py-8 text-center">
          <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{t('rosterEmpty')}</p>
          <p className="max-w-sm text-13 text-muted-foreground">{t('rosterEmptyHint')}</p>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
          <AnimatePresence initial={false}>
            {courses.map((c, index) => {
              const status = c.isArchived
                ? t('statusArchived')
                : c.isPublished
                  ? t('statusPublished')
                  : t('statusDraft');
              return (
                <m.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: spring.smooth }}
                  exit={{ opacity: 0, x: -8, transition: transition.leave }}
                  className="flex flex-wrap items-center gap-3 bg-card px-3 py-3 sm:flex-nowrap sm:px-4"
                >
                  <span
                    aria-hidden="true"
                    className="w-5 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-surface-sunken">
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <GraduationCap className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p dir="auto" className="min-w-0 truncate text-sm font-medium text-foreground">
                        {c.title}
                      </p>
                      <StatusPill
                        label={status}
                        tone={c.isArchived ? 'slate' : c.isPublished ? 'emerald' : 'amber'}
                      />
                      {typeof c.difficulty === 'number' && (
                        <StatusPill
                          label={tAdmin(difficultyKey(c.difficulty), { default: difficultyFallback(c.difficulty) })}
                          tone={difficultyTone(c.difficulty)}
                          dot={false}
                        />
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <bdi dir="ltr" className="truncate font-mono">
                        /{c.slug}
                      </bdi>
                      {typeof c.estimatedHours === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {t('hoursShort', { count: c.estimatedHours })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="ms-auto flex shrink-0 items-center gap-1">
                    <a
                      href={`/admin/courses/${c.slug}/edit`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-13 font-medium text-foreground transition hover:bg-muted"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {t('openStudio')}
                    </a>
                    <button
                      type="button"
                      onClick={() => void remove(c.slug)}
                      disabled={removing === c.slug}
                      aria-label={t('removeCourse', { title: c.title })}
                      title={t('removeCourse', { title: c.title })}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-13 font-medium text-destructive transition hover:bg-destructive/8 disabled:opacity-50"
                    >
                      {removing === c.slug ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" aria-hidden="true" />
                      )}
                      <span aria-hidden="true">{t('remove')}</span>
                    </button>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}

      {/* Search to add. Results list underneath rather than a floating popover, so
          nothing overflows on a phone. */}
      <div
        className="flex flex-col gap-2"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        <label htmlFor={searchId} className="text-13 font-medium text-foreground">
          {t('addCourse')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-h-11 min-w-0 flex-[1_1_16rem] items-center gap-2 rounded-lg border border-border/90 bg-card px-3 shadow-xs transition focus-within:border-primary/50 focus-within:ring-[3px] focus-within:ring-primary/15">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              autoComplete="off"
              placeholder={t('addCoursePlaceholder')}
              aria-controls={`${searchId}-results`}
              onFocus={request}
              onChange={(e) => {
                request();
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                const first = suggestions[0];
                if (e.key === 'Enter' && first && query.trim()) {
                  e.preventDefault();
                  void assign([first.slug]);
                }
                if (e.key === 'Escape') setQuery('');
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              request();
              setPickerOpen(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('browseCourses')}
          </button>
        </div>
        <div
          id={`${searchId}-results`}
          // Safari does not focus a button on press; keep focus in the input so the
          // list is not hidden before the click lands.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(!showSuggestions && 'hidden')}
        >
          <p className="sr-only" aria-live="polite">
            {options === null ? t('pickerLoading') : t('addCourseResults', { count: suggestions.length })}
          </p>
          {options === null ? (
            <p className="flex items-center gap-2 px-1 py-2 text-13 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {t('pickerLoading')}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-1 py-2 text-13 text-muted-foreground">{t('addCourseNoMatch')}</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card">
              {suggestions.map((c) => {
                const busy = assigning?.includes(c.slug);
                const elsewhere = !!c.academyId && c.academyId !== academyId;
                return (
                  <li key={c.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span dir="auto" className="block truncate text-13 font-medium text-foreground">
                        {c.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <bdi dir="ltr" className="font-mono">
                          /{c.slug}
                        </bdi>
                        {elsewhere && <> · {t('inAnotherAcademy')}</>}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void assign([c.slug])}
                      disabled={!!assigning}
                      aria-label={`${t('add')} ${c.title}`}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-13 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" aria-hidden="true" />}
                      <span aria-hidden="true">{t('add')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <CoursePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        academyTitle={academyTitle}
        options={options}
        rosterSlugs={rosterSlugs}
        assigning={!!assigning}
        onAssign={async (slugs) => {
          if (await assign(slugs)) setPickerOpen(false);
        }}
      />
    </div>
  );
}

/** Multi-select picker over every course in the tenant. */
function CoursePicker({
  open,
  onOpenChange,
  academyTitle,
  options,
  rosterSlugs,
  assigning,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academyTitle: string;
  options: CourseOption[] | null;
  rosterSlugs: Set<string>;
  assigning: boolean;
  onAssign: (slugs: string[]) => void | Promise<void>;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const tCommon = useTranslations('common');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);
  const filtered = (options ?? []).filter((c) => matches(c, query));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" aria-label={t('pickerTitle', { title: academyTitle })}>
        <DialogHeader>
          <DialogTitle>{t('pickerTitle', { title: academyTitle })}</DialogTitle>
        </DialogHeader>
        <div className="shrink-0 px-5 pb-3 sm:px-7">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-surface-sunken/60 px-3 transition focus-within:border-primary/50 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              type="search"
              aria-label={t('pickerSearch')}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder={t('pickerSearch')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <DialogBody className="max-h-80 border-t border-border/70 p-0 sm:p-0">
          {options === null ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t('pickerLoading')}</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t('pickerEmpty')}</div>
          ) : (
            filtered.map((c) => {
              const already = rosterSlugs.has(c.slug);
              const checked = already || selected.includes(c.slug);
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 border-b border-border/60 px-5 py-2.5 transition-colors last:border-0 sm:px-7',
                    already ? 'cursor-default opacity-50' : 'hover:bg-muted/40',
                    selected.includes(c.slug) && !already && 'bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={already}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, c.slug] : prev.filter((s) => s !== c.slug),
                      )
                    }
                    className="size-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-13 font-medium text-foreground">
                      {c.title}
                    </span>
                    <bdi dir="ltr" className="block truncate font-mono text-2xs text-muted-foreground">
                      /{c.slug}
                    </bdi>
                  </span>
                  {already && <StatusPill label={t('alreadyAssigned')} tone="emerald" dot={false} />}
                </label>
              );
            })
          )}
        </DialogBody>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-10 items-center rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void onAssign(selected)}
            disabled={assigning || selected.length === 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
          >
            {assigning && <Loader2 className="size-4 animate-spin" />}
            {assigning ? t('assigning') : t('assign')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
