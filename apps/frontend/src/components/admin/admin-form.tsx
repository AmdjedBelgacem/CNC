'use client';
import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from './admin-ui';

/* -----------------------------------------------------------------------------
 * Admin form system.
 *
 * The editor screens (academy, course, product, certificate, settings) were each
 * re-declaring their own `Field` wrapper and copy-pasting the same long input
 * class string on every control. This module is the single definition, so a form
 * control looks and behaves the same everywhere in the admin.
 *
 * Accessibility is handled here rather than at each call site: `Field` wires a
 * generated id into the label, the control and any hint/error text, so screen
 * readers announce the right thing without the caller thinking about it.
 * --------------------------------------------------------------------------- */

const CONTROL_BASE =
  'w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-150 ' +
  'placeholder:text-muted-foreground/60 ' +
  'hover:border-border-strong ' +
  'focus:border-primary/50 focus:ring-[3px] focus:ring-primary/15 ' +
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

export function TextInput({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid && 'border-destructive focus:border-destructive', className)}
      {...props}
    />
  );
}

export function TextArea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        'min-h-24 resize-y leading-relaxed',
        invalid && 'border-destructive focus:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  invalid,
  children,
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      /*
       * The chevron is an inline style rather than Tailwind classes. The
       * arbitrary background-image and background-position utilities fall into
       * the same tailwind-merge group as the background colour in CONTROL_BASE,
       * so merge kept them and dropped the colour — the select then rendered
       * with the browser's default light widget in dark mode, with no chevron.
       * An inline style cannot be collapsed by merge.
       */
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundSize: '16px 16px',
        // Mirrored in RTL so the chevron stays on the reading-end side.
        backgroundPosition: 'right 0.65rem center',
        ...(typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
          ? { backgroundPosition: 'left 0.65rem center' }
          : null),
        ...style,
      }}
      className={cn(
        CONTROL_BASE,
        'cursor-pointer appearance-none pe-9',
        invalid && 'border-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * A labelled form control. Generates and wires an id so the label, control,
 * hint and error are correctly associated for assistive technology.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  labelClassName,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby': string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
  labelClassName?: string;
  htmlFor?: string;
}) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className={cn('block text-13 font-medium text-foreground', labelClassName)}
      >
        {label}
        {required && (
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, invalid: !!error })}
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0, transition: { duration: 0.22, ease: ease.emerge } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.14, ease: ease.exit } }}
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

/** Convenience wrapper for the common "label + single control" case. */
export function TextField({
  label,
  hint,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={props.id}>
      {(a) => <TextInput {...props} {...a} />}
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={props.id}>
      {(a) => <TextArea {...props} {...a} />}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={props.id}>
      {(a) => <SelectInput {...props} {...a}>{children}</SelectInput>}
    </Field>
  );
}

/** A labelled switch, for boolean settings that deserve a sentence of context. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 transition-colors duration-150 hover:border-border',
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  );
}

/**
 * A titled card that groups related controls. The heading level is a prop so the
 * document outline stays correct when a form nests sections.
 */
export function FormSection({
  id,
  title,
  description,
  icon: Icon,
  badge,
  actions,
  children,
  className,
  bodyClassName,
  as: Heading = 'h2',
}: {
  /** Anchor target for `SectionNav`. */
  id?: string;
  /** Small marker next to the title, e.g. "Optional". */
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <section
      id={id}
      className={cn(
        'flex scroll-mt-24 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Heading className="flex items-center gap-2 font-display text-[1.0625rem] font-medium leading-snug tracking-[-0.015em] text-foreground">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            {title}
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-2xs font-medium tracking-normal text-muted-foreground">
                {badge}
              </span>
            )}
          </Heading>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('flex-1 p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Responsive grid for laying out fields. */
export function FieldGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 1 ? 'grid-cols-1' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A sticky action bar. Editor screens need the save button reachable no matter
 * how long the form is, and the dirty state needs to be visible while editing.
 */
export function FormActions({
  dirty,
  saving,
  onSave,
  onReset,
  onCancel,
  saveLabel,
  resetLabel,
  cancelLabel,
  extra,
  children,
}: {
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  resetLabel?: string;
  cancelLabel?: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations('ui.adminForm');
  const tc = useTranslations('common');
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-col items-stretch gap-3 border-t border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:justify-start">
        <AnimatePresence mode="wait" initial={false}>
          {dirty ? (
            <m.span
              key="dirty"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.emerge } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: ease.exit } }}
              className="inline-flex items-center gap-1.5 font-medium text-warning"
            >
              <span className="relative flex size-1.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-warning" />
              </span>
              {t('unsavedChanges')}
            </m.span>
          ) : (
            <m.span
              key="saved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.emerge } }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: ease.exit } }}
            >
              {t('allChangesSaved')}
            </m.span>
          )}
        </AnimatePresence>
        {extra}
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border/80 bg-card px-4 py-2 text-13 font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:opacity-50 sm:h-auto sm:flex-none"
          >
            {cancelLabel ?? tc('cancel')}
          </button>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={saving || !dirty}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border/80 bg-card px-4 py-2 text-13 font-medium text-foreground shadow-xs transition hover:border-border-strong hover:bg-muted/60 active:scale-[0.98] disabled:opacity-40 sm:h-auto sm:flex-none"
          >
            {resetLabel ?? t('discard')}
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-13 font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:shadow-none sm:h-auto sm:flex-none"
          >
            {saving ? tc('saving') : (saveLabel ?? tc('saveChanges'))}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Loading placeholder shaped like a form panel. */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
        <Skeleton className="h-4 w-40" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
