'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Was `bg-overlay` with no alpha — a fully opaque slab in light mode.
      'fixed inset-0 z-50 bg-overlay/60 backdrop-blur-sm',
      // Both states previously mapped to `animate-fade-in`, which meant the
      // backdrop *brightened* as the dialog closed. Exit needs its own keyframe.
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
      // Radix keeps the node mounted during the exit animation and then unmounts
      // it; without `pointer-events-none` the fading overlay swallows the click
      // that was meant to dismiss the dialog behind it.
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
    className={cn('text-lg font-semibold leading-tight tracking-tight text-foreground', className)}
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
    const needsTitle =
      !hasElement(children, DialogTitle) && !hasElement(children, DialogPrimitive.Title);
    const needsDescription =
      ariaDescribedBy === undefined &&
      !hasElement(children, DialogDescription) &&
      !hasElement(children, DialogPrimitive.Description);

    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
          ref={ref}
          aria-describedby={needsDescription ? undefined : ariaDescribedBy}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl focus:outline-none',
            // `scale-in`/`scale-out` both keyframe `transform: scale()`, which
            // would clobber the centring `-translate-x-1/2 -translate-y-1/2`
            // above and throw the dialog into the corner mid-animation. The
            // centring offsets are folded into the keyframes instead — see
            // `.dialog-pop` below, which composes them in the right order.
            'dialog-pop data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out',
            'data-[state=closed]:pointer-events-none',
            dialogSizes[size],
            className,
          )}
          {...props}
        >
          {needsTitle && (
            <DialogTitle asChild>
              <VisuallyHidden>{title}</VisuallyHidden>
            </DialogTitle>
          )}
          {children}
          {!hideClose && (
            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute end-2 top-2 z-10 rounded-lg p-2 text-muted-foreground/70 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:end-3 sm:top-3"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // `pe-*` reserves room for the absolutely-positioned close button, so a long
      // title or description can never slide underneath it.
      'flex shrink-0 flex-col gap-1.5 border-b border-border px-4 py-4 pe-12 sm:px-6 sm:py-5 sm:pe-14',
      className,
    )}
    {...props}
  />
);

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5',
      className,
    )}
    {...props}
  />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface-sunken/40 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:flex-row sm:justify-end sm:px-6 sm:py-4',
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
