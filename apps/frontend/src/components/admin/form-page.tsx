'use client';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import { Check, Loader2, Lock, LockOpen, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { Field, TextInput } from './admin-form';

/* -----------------------------------------------------------------------------
 * Form page kit — the scaffold every admin create / edit screen shares.
 *
 * `admin-form.tsx` defines the controls. This module defines the *page* around
 * them, which each screen used to invent for itself: where Save lives, how a
 * long form is navigated, what a brand-new record's status says, how a slug or a
 * colour is entered. Using one scaffold means the screens behave the same way —
 * and a keyboard shortcut, an unsaved-changes guard or a motion tweak is made
 * once.
 *
 *   <FormLayout aside={<SectionNav items={…} />}>
 *     <FormSection id="basics" …>…</FormSection>
 *   </FormLayout>
 *   <SaveDock mode="edit" dirty saving onSave onDiscard />
 *
 * See docs/design/ADMIN_FORMS.md.
 * --------------------------------------------------------------------------- */

/* ── Behaviour ───────────────────────────────────────────────────────────── */

/**
 * ⌘S / Ctrl+S saves, and leaving the page with unsaved edits asks first.
 *
 * `onSave` is read through a ref so the listener is attached once and always
 * calls the latest handler — screens pass inline closures.
 */
export function useFormGuard({
  dirty,
  saving = false,
  onSave,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave?: () => void;
}) {
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        // Always claim the shortcut: the browser's "save page" dialog is never wanted here.
        event.preventDefault();
        if (dirty && !saving) saveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by some browsers to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/** True for ~1.8s after `saving` falls from true to false without an error. */
export function useJustSaved(saving: boolean, failed = false) {
  const [justSaved, setJustSaved] = useState(false);
  const was = useRef(saving);
  useEffect(() => {
    if (was.current && !saving && !failed) {
      setJustSaved(true);
      const timer = window.setTimeout(() => setJustSaved(false), 1800);
      was.current = saving;
      return () => window.clearTimeout(timer);
    }
    was.current = saving;
  }, [saving, failed]);
  return justSaved;
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

/**
 * Main column plus an optional sticky rail. The rail is where a long form's
 * section navigation and summary live; it collapses under the form below `xl`.
 */
export function FormLayout({
  children,
  aside,
  className,
  width = 'default',
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  /** `narrow` for short create forms, `default` for editors. */
  width?: 'narrow' | 'default';
}) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full gap-6 pb-28',
        width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl',
        aside && 'xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-8',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {aside ? (
        <aside className="hidden xl:block">
          <div className="sticky top-24 flex flex-col gap-4">{aside}</div>
        </aside>
      ) : null}
    </div>
  );
}

export interface SectionNavItem {
  id: string;
  label: ReactNode;
  icon?: LucideIcon;
  /** Small trailing marker, e.g. an error dot or a count. */
  badge?: ReactNode;
  invalid?: boolean;
}

/**
 * "On this page" navigation with scroll-spy. The active marker is a shared
 * layout element, so it glides between sections instead of jumping.
 */
export function SectionNav({
  items,
  className,
}: {
  items: SectionNavItem[];
  className?: string;
}) {
  const t = useTranslations('ui.adminForm');
  const groupId = useId();
  const [active, setActive] = useState(items[0]?.id ?? '');
  const ids = useMemo(() => items.map((item) => item.id).join('|'), [items]);

  useEffect(() => {
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
        // The topmost section that is in the reading band wins.
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      // A band across the upper third of the viewport.
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  }, []);

  return (
    <nav
      aria-label={t('onThisPage')}
      className={cn('rounded-xl border border-border/70 bg-card p-2 shadow-xs', className)}
    >
      <p className="px-2.5 pb-1.5 pt-1.5 text-xs font-medium text-muted-foreground">
        {t('onThisPage')}
      </p>
      <LayoutGroup id={groupId}>
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => jump(item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-13 transition-colors',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId="form-section-nav-pill"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-lg bg-muted"
                    />
                  )}
                  <span className="relative flex min-w-0 flex-1 items-center gap-2">
                    {Icon && <Icon className="size-3.5 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.invalid ? (
                    <span
                      className="relative size-1.5 shrink-0 rounded-full bg-destructive"
                      aria-label={t('hasErrors')}
                    />
                  ) : item.badge ? (
                    <span className="relative shrink-0 text-2xs text-muted-foreground">{item.badge}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}

/* ── Status ──────────────────────────────────────────────────────────────── */

type StatusTone = 'new' | 'draft' | 'live' | 'archived';

const STATUS_STYLE: Record<StatusTone, { dot: string; text: string; bg: string }> = {
  new: { dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary/10' },
  draft: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' },
  live: { dot: 'bg-success', text: 'text-success', bg: 'bg-success/10' },
  archived: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-muted' },
};

/**
 * One status chip for every record. A record that does not exist yet is `new` —
 * the command bar used to print "Live" over a form for something never saved.
 */
export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const style = STATUS_STYLE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        style.bg,
        style.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

/* ── Save dock ───────────────────────────────────────────────────────────── */

/**
 * The one place Save lives.
 *
 * - `edit` mode: the dock is only on screen while there is something to act on —
 *   unsaved edits, a save in flight, or a moment of "Saved" confirmation. A form
 *   with nothing to save shows no bar at all.
 * - `create` mode: the dock is always present with Cancel and the create action,
 *   which is disabled until `canSave`.
 */
export function SaveDock({
  mode = 'edit',
  dirty = false,
  saving = false,
  canSave = true,
  failed = false,
  onSave,
  onDiscard,
  onCancel,
  saveLabel,
  savingLabel,
  extra,
}: {
  mode?: 'edit' | 'create';
  dirty?: boolean;
  saving?: boolean;
  /** Create mode: whether required fields are filled. */
  canSave?: boolean;
  failed?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  onCancel?: () => void;
  saveLabel?: ReactNode;
  savingLabel?: ReactNode;
  extra?: ReactNode;
}) {
  const t = useTranslations('ui.adminForm');
  const tc = useTranslations('common');
  const justSaved = useJustSaved(saving, failed);
  useFormGuard({ dirty: mode === 'edit' ? dirty : false, saving, onSave });

  const visible = mode === 'create' || dirty || saving || justSaved;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 lg:ps-16">
      <AnimatePresence initial={false}>
        {visible && (
          <m.div
            key="dock"
            role="region"
            aria-label={t('actions')}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.smooth }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16, ease: ease.exit } }}
            className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border/80 bg-card/90 py-2 pe-2 ps-4 shadow-lg backdrop-blur-xl"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 text-13" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                {saving ? (
                  <m.span
                    key="saving"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex items-center gap-2 text-muted-foreground"
                  >
                    <Loader2 className="size-3.5 animate-spin" />
                    {savingLabel ?? tc('saving')}
                  </m.span>
                ) : justSaved ? (
                  <m.span
                    key="saved"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex items-center gap-2 font-medium text-success"
                  >
                    <m.span
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={spring.snappy}
                      className="flex size-4 items-center justify-center rounded-full bg-success text-success-foreground"
                    >
                      <Check className="size-2.5" strokeWidth={3} />
                    </m.span>
                    {t('savedJustNow')}
                  </m.span>
                ) : mode === 'create' ? (
                  <m.span
                    key="create"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="truncate text-muted-foreground"
                  >
                    {canSave ? t('readyToCreate') : t('fillRequired')}
                  </m.span>
                ) : (
                  <m.span
                    key="dirty"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex items-center gap-2 font-medium text-warning"
                  >
                    <span className="relative flex size-1.5" aria-hidden="true">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-warning" />
                    </span>
                    {t('unsavedChanges')}
                  </m.span>
                )}
              </AnimatePresence>
              {extra}
            </div>

            {mode === 'create' && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="pressable inline-flex h-9 items-center rounded-lg px-3 text-13 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {tc('cancel')}
              </button>
            )}
            {mode === 'edit' && onDiscard && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving || !dirty}
                className="pressable inline-flex h-9 items-center rounded-lg px-3 text-13 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                {t('discard')}
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving || (mode === 'edit' ? !dirty : !canSave)}
                className="pressable inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-13 font-medium text-primary-foreground shadow-sm transition-[background-color,opacity] hover:bg-primary/90 disabled:opacity-40"
              >
                {saveLabel ?? tc('saveChanges')}
                {mode === 'edit' && (
                  <kbd className="hidden rounded border border-primary-foreground/30 px-1 font-sans text-2xs text-primary-foreground/80 sm:inline">
                    {isMac ? '⌘S' : 'Ctrl S'}
                  </kbd>
                )}
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Slug ────────────────────────────────────────────────────────────────── */

export function slugify(input: string, max = 80) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/**
 * URL slug entry.
 *
 * Create: follows the title until the author types in it themselves.
 * Edit: locked behind an explicit unlock, because changing a published slug
 * breaks every existing link — and a plain disabled input reads as "broken".
 */
export function SlugField({
  label,
  value,
  onChange,
  prefix,
  source,
  mode = 'create',
  hint,
  error,
}: {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** Public path shown in front of the slug, e.g. `/academy/`. */
  prefix: string;
  /** Create mode: the title the slug follows until edited by hand. */
  source?: string;
  mode?: 'create' | 'edit';
  hint?: ReactNode;
  error?: ReactNode;
}) {
  const t = useTranslations('ui.adminForm');
  const [touched, setTouched] = useState(false);
  const [unlocked, setUnlocked] = useState(mode === 'create');

  useEffect(() => {
    if (mode === 'create' && !touched && source !== undefined) onChange(slugify(source));
    // `onChange` is intentionally omitted: callers pass an inline closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, touched, mode]);

  const locked = mode === 'edit' && !unlocked;

  return (
    <Field
      label={label}
      error={error}
      hint={
        hint ??
        (locked ? t('slugLocked') : mode === 'edit' ? t('slugWarning') : t('slugFollowsTitle'))
      }
    >
      {(props) => (
        <div className="flex items-stretch gap-2">
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center rounded-lg border bg-card text-sm shadow-xs transition-[border-color,box-shadow]',
              locked ? 'border-border/70 bg-muted/50' : 'border-border/90 focus-within:border-primary/50 focus-within:ring-[3px] focus-within:ring-primary/15',
              props.invalid && 'border-destructive',
            )}
          >
            <span className="select-none ps-3 font-mono text-xs text-muted-foreground" dir="ltr">
              {prefix}
            </span>
            <TextInput
              {...props}
              dir="ltr"
              value={value}
              readOnly={locked}
              onChange={(event) => {
                setTouched(true);
                onChange(slugify(event.target.value));
              }}
              className="min-w-0 flex-1 border-0 bg-transparent px-1 font-mono shadow-none ring-0 focus:ring-0 focus:border-0"
            />
          </div>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setUnlocked((v) => !v)}
              aria-pressed={unlocked}
              title={locked ? t('slugUnlock') : t('slugLock')}
              className="pressable inline-flex w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
            >
              {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              <span className="sr-only">{locked ? t('slugUnlock') : t('slugLock')}</span>
            </button>
          )}
        </div>
      )}
    </Field>
  );
}

/* ── Colour ──────────────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/;

/** House palette offered as one-click presets. */
const COLOR_PRESETS = ['#B65433', '#4D6E58', '#141413', '#7A5C3E', '#3F6F8A', '#8A4B6B'] as const;

/**
 * Hex colour entry: a swatch that opens the native picker, a validated hex
 * field, and the house palette as presets. Starts from the brand clay, not an
 * arbitrary default.
 */
export function ColorField({
  label,
  value,
  onChange,
  hint,
  presets = COLOR_PRESETS,
}: {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  hint?: ReactNode;
  presets?: readonly string[];
}) {
  const t = useTranslations('ui.adminForm');
  const valid = HEX.test(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  return (
    <Field label={label} hint={hint} error={!valid && value ? t('colorInvalid') : undefined}>
      {(props) => (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pickerRef.current?.click()}
              aria-label={t('pickColor')}
              className="pressable relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/80 shadow-xs"
              style={{ backgroundColor: valid ? value : 'transparent' }}
            >
              <input
                ref={pickerRef}
                type="color"
                tabIndex={-1}
                value={valid ? value : '#B65433'}
                onChange={(event) => onChange(event.target.value.toUpperCase())}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </button>
            <TextInput
              {...props}
              dir="ltr"
              value={value}
              maxLength={7}
              spellCheck={false}
              onChange={(event) => {
                const raw = event.target.value.trim();
                onChange((raw.startsWith('#') ? raw : `#${raw}`).toUpperCase());
              }}
              className="font-mono uppercase"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('presets')}>
            {presets.map((preset) => {
              const selected = preset.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  aria-label={preset}
                  aria-pressed={selected}
                  className={cn(
                    'pressable relative size-6 rounded-full border border-black/10 transition-transform hover:scale-110',
                    selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                  )}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>
        </div>
      )}
    </Field>
  );
}
