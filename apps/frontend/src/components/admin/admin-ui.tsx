'use client';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Shared content primitives — token surfaces, 12px radii, 36px controls.
 * Page chrome (command bar, title, KPIs) lives in ./admin-chrome. */

/* Toolbar shell */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5">
      {children}
    </div>
  );
}

export function PillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: ReactNode }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]',
            value === o.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 shrink-0 rounded-xl border border-border bg-background px-2.5 text-[13px] text-foreground outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
    >
      {children}
    </select>
  );
}

/* Table shell */
export function TableCard({
  header,
  children,
  footer,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {header && (
        <div className="hidden border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:block">
          {header}
        </div>
      )}
      {children}
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{' '}
        <span className="font-semibold text-foreground">{totalPages}</span> ·{' '}
        <span className="font-medium">{total}</span> total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: any;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
