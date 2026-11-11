'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { AlertCircle, Check, Eye, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { TextArea, TextInput } from '@/components/admin/admin-form';
import { StatusChip, useFormGuard } from '@/components/admin/form-page';

/* -----------------------------------------------------------------------------
 * Editor kit — the one editing experience for products, courses and academies.
 *
 * Each of the three used to be its own paradigm: a step wizard with autosave
 * for courses, long single forms with a save dock for the other two, and
 * Arabic as a separate block at the bottom of the page. This kit gives them one
 * shell: a header that says where the record stands, a rail of sections that
 * says what is done, the form, and an aside that shows the result.
 *
 *   <LanguageModeProvider>
 *     <EditorHeader … />
 *     <EditorLayout rail={<EditorRail … />} aside={…}>
 *       <BilingualField … />
 *     </EditorLayout>
 *   </LanguageModeProvider>
 * --------------------------------------------------------------------------- */

/* ── Language mode ───────────────────────────────────────────────────────── */

export type LanguageMode = 'en' | 'both' | 'ar';

const LanguageModeContext = createContext<{
  mode: LanguageMode;
  setMode: (mode: LanguageMode) => void;
}>({ mode: 'both', setMode: () => {} });

const MODE_STORAGE_KEY = 'admin-editor-language-mode';

/**
 * Which languages the editor shows. Remembered per browser, so an editor who
 * only writes English is not shown Arabic fields on every record.
 */
export function LanguageModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>('both');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'en' || stored === 'both' || stored === 'ar') setModeState(stored);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  const setMode = useCallback((next: LanguageMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <LanguageModeContext.Provider value={value}>{children}</LanguageModeContext.Provider>;
}

export function useLanguageMode() {
  return useContext(LanguageModeContext);
}

export function LanguageModeToggle({ className }: { className?: string }) {
  const t = useTranslations('admin.editorKit');
  const { mode, setMode } = useLanguageMode();
  const options: { id: LanguageMode; label: string; lang?: string }[] = [
    { id: 'en', label: t('modeEnglish') },
    { id: 'both', label: t('modeBoth') },
    { id: 'ar', label: 'العربية', lang: 'ar' },
  ];
  return (
    <div
      role="group"
      aria-label={t('modeLabel')}
      className={cn('inline-flex rounded-full border border-border/70 bg-muted p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => setMode(option.id)}
            className={cn(
              'relative min-h-9 rounded-full px-3.5 text-13 transition-colors',
              active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId="editor-language-mode"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                className="absolute inset-0 rounded-full bg-card shadow-xs"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Bilingual field ─────────────────────────────────────────────────────── */

function LangTag({ lang }: { lang: 'EN' | 'AR' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-2.5 inline-flex h-5 min-w-[1.375rem] items-center justify-center rounded-md px-1.5 font-mono text-[10.5px] font-medium tracking-wide',
        lang === 'EN' ? 'end-2.5 bg-muted text-muted-foreground' : 'start-2.5 bg-accent/15 text-accent',
      )}
    >
      {lang}
    </span>
  );
}

/**
 * One field in two languages, side by side.
 *
 * The English control comes first in reading order; the Arabic one is
 * right-to-left and says so. When the Arabic is empty, the field offers to
 * draft it from English instead of showing a blank box. The language toggle
 * in the header decides which halves are visible; hidden halves keep their
 * values.
 */
export function BilingualField({
  id,
  label,
  required,
  hint,
  error,
  multiline = false,
  rows = 4,
  en,
  ar,
  onDraftArabic,
  drafting = false,
  stacked = false,
  className,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  multiline?: boolean;
  rows?: number;
  en: { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean };
  /** Omit for a field that has no Arabic copy. */
  ar?: { value: string; onChange: (value: string) => void; placeholder?: string };
  /** Fill missing Arabic from the English copy (AI draft, reviewed by a person). */
  onDraftArabic?: () => void;
  drafting?: boolean;
  /** Put Arabic under English, for narrow panels such as the lesson inspector. */
  stacked?: boolean;
  className?: string;
}) {
  const t = useTranslations('admin.editorKit');
  const { mode } = useLanguageMode();
  const showEn = mode !== 'ar' || !ar;
  const showAr = !!ar && mode !== 'en';
  const both = showEn && showAr;
  const arId = `${id}-ar`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  const [arOpen, setArOpen] = useState(false);
  const arEmpty = !!ar && !ar.value.trim();

  const control = (lang: 'en' | 'ar') => {
    const field = lang === 'en' ? en : ar!;
    const common = {
      id: lang === 'en' ? id : arId,
      value: field.value,
      placeholder: field.placeholder,
      'aria-describedby': lang === 'en' ? describedBy : undefined,
      'aria-label': lang === 'ar' ? t('arabicOf', { field: typeof label === 'string' ? label : '' }) : undefined,
      dir: lang === 'ar' ? ('rtl' as const) : undefined,
      lang: lang === 'ar' ? 'ar' : undefined,
      className: cn(
        'min-h-11',
        lang === 'en' ? 'pe-11' : 'ps-11',
        lang === 'ar' && 'text-right',
      ),
    };
    return multiline ? (
      <TextArea
        {...common}
        rows={rows}
        invalid={lang === 'en' && !!error}
        autoFocus={lang === 'en' ? en.autoFocus : arOpen}
        onChange={(e) => field.onChange(e.target.value)}
      />
    ) : (
      <TextInput
        {...common}
        invalid={lang === 'en' && !!error}
        autoFocus={lang === 'en' ? en.autoFocus : arOpen}
        onChange={(e) => field.onChange(e.target.value)}
      />
    );
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={showEn ? id : arId} className="block text-13 font-medium text-foreground">
        {label}
        {required && (
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className={cn('grid gap-3', both && !stacked ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
        {showEn && (
          <div className="relative">
            {control('en')}
            {ar && <LangTag lang="EN" />}
          </div>
        )}
        {showAr &&
          (arEmpty && !arOpen ? (
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border-strong bg-background px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {onDraftArabic && (
                  <button
                    type="button"
                    onClick={onDraftArabic}
                    disabled={drafting || !en.value.trim()}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border-strong bg-card px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {drafting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-primary" />
                    )}
                    {t('draftFromEnglish')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setArOpen(true)}
                  className="inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {t('writeArabic')}
                </button>
              </div>
              <span lang="ar" dir="rtl" className="text-xs text-muted-foreground">
                لا توجد ترجمة بعد
              </span>
            </div>
          ) : (
            <div className="relative">
              {control('ar')}
              <LangTag lang="AR" />
            </div>
          ))}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2, ease: ease.emerge } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.12, ease: ease.exit } }}
            className="flex items-start gap-1.5 overflow-hidden text-xs text-destructive"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span>{error}</span>
          </m.p>
        )}
      </AnimatePresence>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── Saving ──────────────────────────────────────────────────────────────── */

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Saves a draft by itself a moment after the last edit.
 *
 * Only for records that are not live: on a published record every keystroke
 * would reach visitors half-typed, so those keep an explicit Save.
 */
export function useAutosave({
  enabled,
  dirty,
  saving,
  save,
  delay = 1200,
  fingerprint,
}: {
  enabled: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<boolean | void> | void;
  delay?: number;
  /** Changes whenever the form value changes, so the timer restarts on each edit. */
  fingerprint: string;
}) {
  const [failed, setFailed] = useState(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!enabled || !dirty || saving) return;
    const timer = window.setTimeout(async () => {
      try {
        const result = await saveRef.current();
        setFailed(result === false);
      } catch {
        setFailed(true);
      }
    }, delay);
    return () => window.clearTimeout(timer);
    // `fingerprint` restarts the debounce on every edit.
  }, [enabled, dirty, saving, delay, fingerprint]);

  return { failed, clearFailed: () => setFailed(false) };
}

/** Derive what the header says about saving. */
export function useSaveState({ dirty, saving, failed }: { dirty: boolean; saving: boolean; failed: boolean }): SaveState {
  const [justSaved, setJustSaved] = useState(false);
  const was = useRef(saving);
  useEffect(() => {
    if (was.current && !saving && !failed && !dirty) {
      setJustSaved(true);
      const timer = window.setTimeout(() => setJustSaved(false), 4000);
      was.current = saving;
      return () => window.clearTimeout(timer);
    }
    was.current = saving;
  }, [saving, failed, dirty]);
  if (saving) return 'saving';
  if (failed) return 'error';
  if (dirty) return 'dirty';
  if (justSaved) return 'saved';
  return 'idle';
}

export function SaveStateLine({
  state,
  autosave,
  onRetry,
}: {
  state: SaveState;
  /** Whether edits save themselves (drafts) or wait for Save (live records). */
  autosave: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('admin.editorKit');
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {state === 'saving' && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {t('saving')}
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="size-3.5 text-success" strokeWidth={2.5} />
          {t('savedJustNow')}
        </>
      )}
      {state === 'dirty' && (
        <>
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          {autosave ? t('savingSoon') : t('unsavedLive')}
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle className="size-3.5 text-destructive" />
          <span className="text-destructive">{t('saveFailed')}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="min-h-6 font-medium text-primary hover:underline">
              {t('retry')}
            </button>
          )}
        </>
      )}
      {state === 'idle' && (
        <>
          <Check className="size-3.5" />
          {autosave ? t('allSaved') : t('upToDate')}
        </>
      )}
    </span>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

export function EditorHeader({
  status,
  saveLine,
  title,
  subtitle,
  previewHref,
  previewLabel,
  onReview,
  reviewLabel,
  extraActions,
  bilingual = true,
}: {
  status: { tone: 'new' | 'draft' | 'live' | 'archived'; label: ReactNode };
  saveLine?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  previewHref?: string | null;
  previewLabel?: ReactNode;
  onReview?: () => void;
  reviewLabel?: ReactNode;
  extraActions?: ReactNode;
  bilingual?: boolean;
}) {
  const t = useTranslations('admin.editorKit');
  return (
    <section className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-4 px-0 pb-5 pt-6 sm:px-1">
      <div className="flex min-w-0 flex-[999_1_26rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
          {saveLine}
        </div>
        <h1 className="text-balance font-display text-[1.75rem] font-medium leading-tight tracking-[-0.015em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && <p className="text-13 text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {bilingual && <LanguageModeToggle />}
        {extraActions}
        {previewHref && (
          <Link
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <Eye className="size-4" />
            {previewLabel ?? t('preview')}
          </Link>
        )}
        {onReview && (
          <button
            type="button"
            onClick={onReview}
            className="pressable inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
          >
            {reviewLabel ?? t('reviewAndPublish')}
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

/**
 * Rail, form, aside. Three columns from `xl` (1280px); the aside drops under the
 * form below that, and the rail turns into a scrolling row on a phone.
 */
export function EditorLayout({
  rail,
  aside,
  children,
}: {
  rail?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-6 pb-28',
        rail && 'lg:grid-cols-[13.5rem_minmax(0,1fr)]',
        rail && aside && 'xl:grid-cols-[13rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[13.5rem_minmax(0,1fr)_21rem]',
      )}
    >
      {rail && (
        <div className="min-w-0 lg:row-span-2">
          <div className="lg:sticky lg:top-20">{rail}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      {aside && (
        <aside className="min-w-0 lg:col-start-2 xl:col-start-3 xl:row-start-1">
          <div className="flex flex-col gap-4 xl:sticky xl:top-20">{aside}</div>
        </aside>
      )}
    </div>
  );
}

/* ── Rail ────────────────────────────────────────────────────────────────── */

export type SectionState = 'done' | 'todo' | 'idle' | 'error';

export interface RailSection {
  id: string;
  label: ReactNode;
  state: SectionState;
  meta?: ReactNode;
}

const DOT: Record<SectionState, string> = {
  done: 'bg-accent',
  todo: 'bg-warning',
  idle: 'bg-border-strong',
  error: 'bg-destructive',
};

/**
 * Sections with what each needs. A dot says done (sage), needs attention
 * (amber), optional (grey) or has an error (red); the active section follows
 * the scroll. `onSelect` replaces scrolling for editors that show one section
 * at a time.
 */
export function EditorRail({
  sections,
  readiness,
  active: controlledActive,
  onSelect,
}: {
  sections: RailSection[];
  readiness?: { done: number; total: number; note?: ReactNode };
  active?: string;
  onSelect?: (id: string) => void;
}) {
  const t = useTranslations('admin.editorKit');
  const groupId = useId();
  const [spied, setSpied] = useState(sections[0]?.id ?? '');
  const active = controlledActive ?? spied;
  const ids = sections.map((s) => s.id).join('|');

  useEffect(() => {
    if (onSelect) return;
    const elements = ids
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setSpied(top[0]);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, onSelect]);

  const go = (id: string) => {
    if (onSelect) {
      onSelect(id);
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setSpied(id);
  };

  const pct = readiness && readiness.total > 0 ? Math.round((readiness.done / readiness.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t('sections')} className="min-w-0">
        <p className="mb-2 hidden px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground lg:block">
          {t('sections')}
        </p>
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {sections.map((section) => {
            const isActive = section.id === active;
            return (
              <li key={section.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(section.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'relative flex min-h-10 w-full items-center gap-2.5 rounded-xl border px-3 text-start text-sm transition-colors',
                    isActive
                      ? 'border-border/80 bg-card font-medium text-foreground shadow-xs'
                      : 'border-transparent text-foreground/80 hover:bg-card/60 hover:text-foreground',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[section.state])} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  {section.meta != null && section.meta !== '' && (
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">{section.meta}</span>
                  )}
                  <span className="sr-only">
                    {section.state === 'done'
                      ? t('stateDone')
                      : section.state === 'todo'
                        ? t('stateTodo')
                        : section.state === 'error'
                          ? t('stateError')
                          : t('stateOptional')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {readiness && (
        <div
          className="hidden flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs lg:flex"
          aria-labelledby={`${groupId}-ready`}
        >
          <div className="flex items-baseline justify-between">
            <span id={`${groupId}-ready`} className="text-13 font-medium text-foreground">
              {t('readyToPublish')}
            </span>
            <span className="font-display text-xl text-foreground">
              {readiness.done}
              <span className="text-sm text-muted-foreground"> {t('ofTotal', { total: readiness.total })}</span>
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={readiness.total}
            aria-valuenow={readiness.done}
            aria-labelledby={`${groupId}-ready`}
          >
            <m.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: ease.emerge }}
            />
          </div>
          {readiness.note && <p className="text-xs leading-relaxed text-muted-foreground">{readiness.note}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Checks ──────────────────────────────────────────────────────────────── */

export interface EditorCheck {
  label: ReactNode;
  detail?: ReactNode;
  ok: boolean;
  /** Element id to jump to when the check is clicked. */
  target?: string;
  /** A failing check that does not block publishing. */
  optional?: boolean;
}

export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.tabIndex >= 0) {
    el.focus({ preventScroll: true });
  }
}

export function CheckList({ checks, onJump }: { checks: EditorCheck[]; onJump?: (target: string) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {checks.map((check, index) => {
        const body = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                check.ok
                  ? 'bg-accent/15 text-accent'
                  : check.optional
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-warning/15 text-warning',
              )}
            >
              {check.ok ? <Check className="size-3" strokeWidth={3} /> : check.optional ? '·' : '!'}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-13 leading-snug text-foreground">{check.label}</span>
              {check.detail && <span className="text-xs leading-relaxed text-muted-foreground">{check.detail}</span>}
            </span>
          </>
        );
        return (
          <li key={index}>
            {check.target && !check.ok ? (
              <button
                type="button"
                onClick={() => (onJump ?? jumpTo)(check.target!)}
                className="flex min-h-9 w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition hover:bg-muted"
              >
                {body}
              </button>
            ) : (
              <div className="flex min-h-9 items-start gap-2.5 px-1.5 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AsideCard({
  title,
  eyebrow,
  meta,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs', className)}>
      {(title || eyebrow || meta) && (
        <div className="flex items-center justify-between gap-2">
          {eyebrow ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</span>
          ) : (
            <span className="text-sm font-medium text-foreground">{title}</span>
          )}
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Section card ────────────────────────────────────────────────────────── */

export function EditorSection({
  id,
  title,
  hint,
  actions,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn('scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-6', className)}
    >
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={`${id}-heading`}
          className="font-display text-[1.375rem] font-medium leading-tight tracking-[-0.015em] text-foreground"
        >
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          {actions}
        </div>
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/* ── Explicit save for live records ──────────────────────────────────────── */

/**
 * A live record's edits wait for Save. Wires ⌘S and the leave-page guard, so a
 * live editor behaves like a draft one except for when changes reach visitors.
 */
export function useLiveSaveGuard({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  useFormGuard({ dirty, saving, onSave });
}
