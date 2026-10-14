'use client';
import type { ReactNode, ElementType } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

export const GLASS_SUB = 'bg-muted/50 border border-border rounded-xl';

export interface ModalTab {
  key: string;
  label: string;
  icon: ElementType;
}

/**
 * Modal header used by the admin panels: avatar/initials, title, subtitle, close.
 * Replaces the old `RightSheetHeader`.
 */
export function ModalHeader({
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
      {loading ? (
        <div className="flex flex-1 items-center gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ) : (
        <>
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-sans text-xl font-semibold',
              gradient,
            )}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[26px] font-semibold leading-tight text-foreground">
              {title}
            </p>
            <p className="truncate font-sans text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </>
      )}
      <DialogPrimitive.Close
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
      >
        <X className="size-5" />
      </DialogPrimitive.Close>
    </div>
  );
}

export function ModalTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ModalTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className={cn(GLASS_SUB, 'mx-6 mt-5 flex gap-1 p-1')}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-sm font-medium transition-all duration-200',
              active === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" /> {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Centred modal dialog. This is the replacement for the old side sheet — the whole
 * product used slide-over panels, which the redesign drops in favour of modals and
 * inline expanding panels.
 */
/**
 * Consistent action bar for admin panels.
 *
 * Convention, matching `DialogFooter`: secondary action first in the DOM, primary
 * last so it sits rightmost on desktop; `flex-col-reverse` makes the primary read
 * first when stacked on mobile. Panels that hand-place buttons in the body drift
 * apart, so route actions through this.
 */
export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border bg-surface-sunken/40 px-4 py-3 sm:flex-row sm:justify-end sm:px-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  header,
  tabs,
  activeTab,
  onTabChange,
  children,
  onClose,
  width = 'max-w-2xl',
  bodyClassName,
  title = 'Details',
}: {
  header: ReactNode;
  tabs?: ModalTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: ReactNode;
  onClose: () => void;
  width?: string;
  bodyClassName?: string;
  title?: string;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out data-[state=closed]:pointer-events-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            // `.dialog-pop` carries the centring so the scale keyframes can't
            // clobber it — see the note in ui/dialog.tsx.
            'dialog-pop fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl',
            'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out data-[state=closed]:pointer-events-none',
            width,
          )}
        >
          <DialogPrimitive.Title asChild>
            <VisuallyHidden>{title}</VisuallyHidden>
          </DialogPrimitive.Title>
          {header}
          {tabs && activeTab !== undefined && onTabChange && (
            <ModalTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
          )}
          <div className={cn('flex-1 overflow-y-auto', bodyClassName)}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
