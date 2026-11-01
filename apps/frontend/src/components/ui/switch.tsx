'use client';
import * as React from 'react';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';

/**
 * Accessible toggle. `@radix-ui/react-switch` is not a dependency here, so this is a
 * hand-rolled button with `role="switch"` on the same API surface
 * (`checked` + `onCheckedChange`) used by the rest of the component library.
 */
const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }
>(({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'peer group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent p-0 transition-colors duration-200',
      checked ? 'justify-end' : 'justify-start',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-primary' : 'bg-border-strong',
      className,
    )}
    {...props}
  >
    {/* `layout` + justify swap lets the knob spring across, and it mirrors
        correctly in RTL with no translate maths. The knob stretches slightly
        while pressed, the way a physical rocker gives under a thumb. */}
    <m.span
      layout
      transition={spring.snappy}
      className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-[width] duration-150 group-active:w-6"
    />
  </button>
));
Switch.displayName = 'Switch';

export { Switch };
