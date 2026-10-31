'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

/* ─────────────────────────────────────────────────────────────────────────────
 * Dialog — Radix for behaviour (focus trap, dismissal, a11y), Framer Motion for
 * the choreography.
 *
 * Radix unmounts closed content immediately, which leaves no time for an exit
 * animation. The `Dialog` root below mirrors the open state into context, and
 * `DialogContent` force-mounts its portal inside `AnimatePresence`, so Framer
 * owns the mount lifecycle: the scrim fades, the sheet rises on a spring, and
 * on close both play out before the node is removed.
 *
 * Centring uses the CSS `translate` property (`.dialog-pop`), which composes
 * independently of the `transform` Framer writes — so scaling never throws the
 * dialog into a corner.
 * ───────────────────────────────────────────────────────────────────────────── */

const DialogOpenContext = React.createContext<boolean | null>(null);

type DialogRootProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

function Dialog({ open: openProp, defaultOpen, onOpenChange, ...props }: DialogRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props} />
    </DialogOpenContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const OVERLAY_CLASS = 'fixed inset-0 z-50 bg-overlay/45 backdrop-blur-[3px]';

/** Standalone overlay (CSS-animated) for callers composing their own content. */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      OVERLAY_CLASS,
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
      'data-[state=closed]:pointer-events-none',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogSizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[min(96vw,1400px)]',
};

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  size?: keyof typeof dialogSizes;
  hideClose?: boolean;
  /** Accessible name when no visible DialogTitle is present in children. */
  title?: string;
  overlayClassName?: string;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display text-xl font-medium leading-tight tracking-[-0.015em] text-foreground sm:text-[1.375rem]',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm leading-relaxed text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

function hasElement(node: React.ReactNode, type: unknown): boolean {
  if (node == null || typeof node === 'boolean') return false;
  if (Array.isArray(node)) return node.some((child) => hasElement(child, type));
  if (!React.isValidElement(node)) return false;
  if (node.type === type) return true;
  const children = (node.props as { children?: React.ReactNode }).children;
  return hasElement(children, type);
}

/** Shared surface classes — also used by ui/modal.tsx so every modal matches. */
export const DIALOG_SURFACE_CLASS =
  'dialog-pop fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xl ring-1 ring-black/[0.02] focus:outline-none dark:ring-white/[0.03]';

/** Motion presets for modal surfaces. */
export const dialogMotion = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.22, ease: ease.emerge } },
    exit: { opacity: 0, transition: { duration: 0.16, ease: ease.exit } },
  },
  surface: {
    initial: { opacity: 0, scale: 0.965, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0, transition: spring.gentle },
    exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.14, ease: ease.exit } },
  },
} as const;

function CloseButton() {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className="absolute end-3 top-3 z-10 grid size-8 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 sm:end-4 sm:top-4"
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  );
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      size = 'md',
      hideClose,
      title = 'Dialog',
      overlayClassName,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const open = React.useContext(DialogOpenContext);
    const needsTitle =
      !hasElement(children, DialogTitle) && !hasElement(children, DialogPrimitive.Title);
    const needsDescription =
      ariaDescribedBy === undefined &&
      !hasElement(children, DialogDescription) &&
      !hasElement(children, DialogPrimitive.Description);

    const inner = (
      <>
        {needsTitle && (
          <DialogTitle asChild>
            <VisuallyHidden>{title}</VisuallyHidden>
          </DialogTitle>
        )}
        {children}
        {!hideClose && <CloseButton />}
      </>
    );

    // Rendered under a bare Radix root (no motion context): fall back to the
    // CSS keyframe choreography so the dialog still animates.
    if (open === null) {
      return (
        <DialogPortal>
          <DialogOverlay className={overlayClassName} />
          <DialogPrimitive.Content
            ref={ref}
            aria-describedby={needsDescription ? undefined : ariaDescribedBy}
            className={cn(
              DIALOG_SURFACE_CLASS,
              'data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out data-[state=closed]:pointer-events-none',
              dialogSizes[size],
              className,
            )}
            {...props}
          >
            {inner}
          </DialogPrimitive.Content>
        </DialogPortal>
      );
    }

    return (
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <m.div
                className={cn(OVERLAY_CLASS, overlayClassName)}
                {...dialogMotion.overlay}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              forceMount
              asChild
              ref={ref}
              aria-describedby={needsDescription ? undefined : ariaDescribedBy}
              {...props}
            >
              <m.div
                className={cn(DIALOG_SURFACE_CLASS, dialogSizes[size], className)}
                {...dialogMotion.surface}
              >
                {inner}
              </m.div>
            </DialogPrimitive.Content>
          </DialogPortal>
        )}
      </AnimatePresence>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // `pe-*` reserves room for the absolutely-positioned close button, so a long
      // title or description can never slide underneath it.
      'flex shrink-0 flex-col gap-1.5 px-5 pb-3 pt-5 pe-14 sm:px-7 sm:pb-4 sm:pt-6 sm:pe-16',
      className,
    )}
    {...props}
  />
);

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7 sm:py-5',
      className,
    )}
    {...props}
  />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:flex-row sm:justify-end sm:px-7 sm:py-4',
      className,
    )}
    {...props}
  />
);

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
