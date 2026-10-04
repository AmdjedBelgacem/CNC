'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Content available to screen readers but not visible on screen.
 * Use as a wrapper for Radix `DialogTitle` when the visual heading is custom.
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="visually-hidden"
    className={cn(
      'absolute h-1 w-1 overflow-hidden whitespace-nowrap border-0 p-0',
      '[clip-path:inset(50%)]',
      className,
    )}
    {...props}
  />
));
VisuallyHidden.displayName = 'VisuallyHidden';
