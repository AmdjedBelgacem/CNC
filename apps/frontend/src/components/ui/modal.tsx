'use client';
import type { ReactNode, ElementType } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { m } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { DIALOG_SURFACE_CLASS, dialogMotion } from '@/components/ui/dialog';
import { spring } from '@/lib/motion';

export const GLASS_SUB = 'bg-muted/60 border border-border/70 rounded-xl';

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
    <div className="flex items-center gap-3 border-b border-border/70 bg-card px-5 py-4 sm:gap-4 sm:px-7 sm:py-5">
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
          <m.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl font-sans text-lg font-semibold shadow-xs ring-1 ring-black/5 sm:size-14 sm:text-xl',
              gradient,
            )}
          >
            {initials}
          </m.span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-medium leading-tight tracking-[-0.015em] text-foreground sm:text-[26px]">
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
        className="grid size-9 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-90"
      >
        <X className="size-[18px]" />
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
    <div
      className={cn(
        GLASS_SUB,
        'no-scrollbar mx-5 mt-4 flex gap-1 overflow-x-auto p-1 sm:mx-7 sm:mt-5',
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'relative flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-sm font-medium transition-colors duration-200',
              active === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active === tab.key && (
              <m.span
                layoutId="modal-tab-indicator"
                transition={spring.smooth}
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border/60"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="size-4" /> {tab.label}
            </span>
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
export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:flex-row sm:justify-end sm:px-7 sm:pb-3.5',
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
        <DialogPrimitive.Overlay asChild>
          <m.div
            className="fixed inset-0 z-50 bg-overlay/45 backdrop-blur-[3px]"
            {...dialogMotion.overlay}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content aria-describedby={undefined} asChild>
          <m.div className={cn(DIALOG_SURFACE_CLASS, width)} {...dialogMotion.surface}>
            <DialogPrimitive.Title asChild>
              <VisuallyHidden>{title}</VisuallyHidden>
            </DialogPrimitive.Title>
            {header}
            {tabs && activeTab !== undefined && onTabChange && (
              <ModalTabs tabs={tabs} active={activeTab} onChange={onTabChange} />
            )}
            <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>
              {children}
            </div>
          </m.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
