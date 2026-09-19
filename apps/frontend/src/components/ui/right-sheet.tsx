'use client';
import { useEffect, useState, type ReactNode, type ElementType } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const GLASS_SUB = 'bg-muted/50 border border-border rounded-xl';
export interface RightSheetTab {
  key: string;
  label: string;
  icon: ElementType;
}
function RightSheetHeader({
  loading,
  initials,
  gradient,
  title,
  subtitle,
  onClose,
}: {
  loading: boolean;
  initials: string;
  gradient: string;
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border bg-card px-6 py-5">
      {' '}
      {loading ? (
        <div className="flex flex-1 items-center gap-4">
          {' '}
          <div className="h-14 w-14 animate-pulse rounded-xl bg-muted" />{' '}
          <div className="flex-1 space-y-2">
            {' '}
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />{' '}
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />{' '}
          </div>{' '}
        </div>
      ) : (
        <>
          {' '}
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-sans text-xl font-semibold',
              gradient,
            )}
          >
            {' '}
            {initials}{' '}
          </span>{' '}
          <div className="min-w-0 flex-1">
            {' '}
            <p className="truncate font-display text-[26px] font-semibold leading-tight text-foreground">
              {title}
            </p>{' '}
            <p className="truncate font-sans text-sm text-muted-foreground">{subtitle}</p>{' '}
          </div>{' '}
        </>
      )}{' '}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
function RightSheetTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: RightSheetTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className={cn(GLASS_SUB, 'mx-6 mt-5 flex gap-1 p-1')}>
      {' '}
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-sm font-medium transition-all duration-200',
              active === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {' '}
            <Icon className="h-4 w-4" /> {tab.label}{' '}
          </button>
        );
      })}{' '}
    </div>
  );
} /** * Frosted right-hand slide-over used across the admin surface. * Mirrors the "liquid glass" language of the directory pages. */
export function RightSheet({
  header,
  tabs,
  activeTab,
  onTabChange,
  children,
  onClose,
  width = 'max-w-[460px]',
  bodyClassName,
}: {
  header: ReactNode;
  tabs?: RightSheetTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: ReactNode;
  onClose: () => void;
  width?: string;
  bodyClassName?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {' '}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      />
      <aside
        className={cn(
          'relative z-10 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out',
          width,
          shown ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {' '}
        {header}{' '}
        {tabs && activeTab !== undefined && onTabChange && (
          <RightSheetTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
        )}{' '}
        <div className={cn('flex-1 overflow-y-auto', bodyClassName)}>{children}</div>{' '}
      </aside>{' '}
    </div>
  );
}
export { RightSheetHeader, RightSheetTabs };
