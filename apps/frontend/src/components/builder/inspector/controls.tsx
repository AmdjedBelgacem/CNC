'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Palette, RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_KEYS, ICON_LABELS, resolveIconName, type IconKey } from '@titan/shared';
import type { FieldOption } from './types'; /** Curated marketing palette swatches (hex values). */
import { Icon } from '@/components/ui/icon';
const PALETTE: Array<FieldOption & { value: string }> = [
  { label: 'Primary blue', labelKey: 'primary-blue', value: '#1B4DB1' },
  { label: 'Secondary green', labelKey: 'secondary-green', value: '#006d30' },
  { label: 'Accent blue', labelKey: 'accent-blue', value: '#1B4DB1' },
  { label: 'Ink', labelKey: 'ink', value: '#111827' },
  { label: 'Slate', labelKey: 'slate', value: '#6b7280' },
  { label: 'White', labelKey: 'white', value: '#ffffff' },
];
const inputClass =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50'; // ------------------------------------------------------------------ FieldRow
interface FieldRowProps {
  label: string;
  /** `builder.fieldLabels.<key>`; `label` stays the fallback. */
  labelKey?: string;
  hint?: string;
  /** `builder.fieldHints.<key>` */
  hintKey?: string;
  dirty?: boolean;
  onReset?: () => void;
  children: ReactNode;
} /** Consistent label + control row for the inspector. */
/**
 * Resolve an inspector string.
 *
 * The English value is passed as the default so an untranslated key shows the
 * label the designer wrote rather than a dotted key at the user.
 */
export function useInspectorText() {
  const t = useTranslations('builder');
  return {
    label: (key: string | undefined, fallback: string) => (key ? t(`fieldLabels.${key}`, { default: fallback }) : fallback),
    hint: (key: string | undefined, fallback: string | undefined) =>
      key && fallback ? t(`fieldHints.${key}`, { default: fallback }) : fallback,
    placeholder: (key: string | undefined, fallback: string | undefined) =>
      key && fallback ? t(`fieldPlaceholders.${key}`, { default: fallback }) : fallback,
    group: (key: string | undefined, fallback: string) => (key ? t(`groups.${key}`, { default: fallback }) : fallback),
  };
}

export function FieldRow({
  label,
  labelKey,
  hint,
  hintKey,
  dirty,
  onReset,
  children,
}: FieldRowProps) {
  const text = useInspectorText();
  const shownLabel = text.label(labelKey, label);
  const shownHint = text.hint(hintKey, hint);
  return (
    <div className="group/row px-3 py-2">
      {' '}
      <div className="mb-1.5 flex h-4 items-center justify-between gap-2">
        {' '}
        <label className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {' '}
          {shownLabel}{' '}
        </label>{' '}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title={dirty ? 'Reset to default' : 'At default'}
            disabled={!dirty}
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none hover:bg-muted hover:text-foreground"
          >
            {' '}
            <RotateCcw className="size-3.5" />{' '}
          </button>
        )}{' '}
      </div>{' '}
      {children}{' '}
      {hint && (
        <p className="mt-1 text-2xs leading-snug text-muted-foreground/70">{shownHint}</p>
      )}{' '}
    </div>
  );
} // ------------------------------------------------------------------ text
export function TextControl({
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={inputClass}
    />
  );
}
export function TextareaControl({
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  return (
    <textarea
      value={value ?? ''}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn(inputClass, 'h-auto resize-y py-2 leading-relaxed')}
    />
  );
}
export function NumberControl({
  value,
  onChange,
  min,
  max,
  step,
  onBlur,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  onBlur?: () => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={onBlur}
      className={inputClass}
    />
  );
} // ------------------------------------------------------------------ select
export function SelectControl({
  value,
  onChange,
  options,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  options: FieldOption[];
}) {
  const text = useInspectorText();
  return (
    <div className="relative">
      {' '}
      <select
        value={options.some((o) => o.value === value) ? String(value) : ''}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) onChange(opt.value);
        }}
        className={cn(inputClass, 'appearance-none pe-8')}
      >
        {' '}
        {!options.some((o) => o.value === value) && <option value="">—</option>}{' '}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {' '}
            {text.label(o.labelKey, o.label)}{' '}
          </option>
        ))}{' '}
      </select>{' '}
      <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />{' '}
    </div>
  );
} // ------------------------------------------------------------------ segmented
export function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  options: FieldOption[];
}) {
  const text = useInspectorText();
  return (
    <div className="flex rounded-md border border-border bg-background p-0.5" role="group">
      {' '}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-[5px] px-2 py-1.5 text-2xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {' '}
            {text.label(o.labelKey, o.label)}{' '}
          </button>
        );
      })}{' '}
    </div>
  );
} // ------------------------------------------------------------------ toggle
export function ToggleControl({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const on = Boolean(value);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        on ? 'bg-primary' : 'bg-muted-foreground/25 hover:bg-muted-foreground/35',
      )}
    >
      {' '}
      <span
        className={cn(
          'inline-block size-4 transform rounded-full bg-card shadow transition-transform duration-200',
          on ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />{' '}
    </button>
  );
} // ------------------------------------------------------------------ slider
export function SliderControl({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
  onPointerUp,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onPointerUp?: () => void;
}) {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : min;
  return (
    <div className="flex items-center gap-2.5">
      {' '}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onPointerUp}
        className="inspector-slider h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />{' '}
      <span className="w-14 shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-center font-mono text-2xs tabular-nums text-foreground">
        {' '}
        {v} {suffix}{' '}
      </span>{' '}
    </div>
  );
} // ------------------------------------------------------------------ color
export function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '';
  const text = useInspectorText();
  return (
    <div className="flex items-center gap-2">
      {' '}
      <div className="flex items-center gap-1">
        {' '}
        {PALETTE.map((p) => (
          <button
            key={p.value}
            type="button"
            // The swatch name is shown as a tooltip, so it is localized too.
            title={text.label(p.labelKey, p.label)}
            onClick={() => onChange(p.value)}
            className={cn(
              'size-5 rounded-full border border-border transition hover:scale-110',
              hex.toUpperCase() === p.value.toUpperCase() &&
                'ring-2 ring-primary ring-offset-1 ring-offset-background',
            )}
            style={{ backgroundColor: p.value }}
          />
        ))}{' '}
      </div>{' '}
      <label
        className="relative flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-border bg-background px-2 transition hover:border-primary"
        title="Open the system color picker"
      >
        {' '}
        <Palette className="size-3.5 text-muted-foreground" />{' '}
        <input
          type="color"
          value={hex || '#1B4DB1'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />{' '}
      </label>{' '}
      <input
        type="text"
        value={value ?? ''}
        placeholder="#1B4DB1"
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, 'h-8 flex-1 font-mono text-xs')}
      />{' '}
    </div>
  );
} // ------------------------------------------------------------------ icon
export function IconControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ICON_KEYS.filter(
      (k) => k !== 'graduation-cap' && (!q || k.includes(q) || (ICON_LABELS[k] ?? '').toLowerCase().includes(q)),
    );
  }, [query]);
  return (
    <div className="relative">
      {' '}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(inputClass, 'flex items-center gap-2')}
      >
        {' '}
        <Icon name={resolveIconName(value) || 'add'} className="text-base text-primary" />{' '}
        <span className="flex-1 truncate text-left text-xs font-medium text-foreground">
          {' '}
          {value ? (ICON_LABELS[value as IconKey] ?? value) : 'Select an icon…'}{' '}
        </span>{' '}
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />{' '}
      </button>{' '}
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-md border border-border bg-card p-2 shadow-sm">
          {' '}
          <div className="relative mb-1.5">
            {' '}
            <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />{' '}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className={cn(inputClass, 'h-8 ps-7 text-xs')}
            />{' '}
          </div>{' '}
          <div className="grid max-h-44 grid-cols-5 gap-0.5 overflow-auto">
            {' '}
            {list.map((k) => (
              <button
                key={k}
                type="button"
                title={ICON_LABELS[k] ?? k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex h-8 items-center justify-center rounded transition',
                  value === k
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {' '}
                <Icon name={resolveIconName(k)} className="text-lg" />{' '}
              </button>
            ))}{' '}
            {list.length === 0 && (
              <p className="col-span-5 py-3 text-center text-2xs text-muted-foreground">
                No icons match “{query}”
              </p>
            )}{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
