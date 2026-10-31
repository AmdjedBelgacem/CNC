'use client';

import { Fragment } from 'react';
import { m } from 'framer-motion';
import { Check } from 'lucide-react';
import { ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Cart → Payment → Done progress rail shared by /cart, /checkout and
 * /checkout/success.
 *
 * The connecting line fills from the previous step to the current one on mount,
 * so arriving at the next page reads as forward progress; the active marker is
 * a `layoutId` halo that glides if the step changes in place.
 */
export function CheckoutStepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Zero-based index of the active step. A value ≥ steps.length marks all complete. */
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label={steps.join(', ')} className={cn('w-full max-w-xl', className)}>
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <Fragment key={label}>
              <li
                className="flex shrink-0 items-center gap-2.5"
                aria-current={active ? 'step' : undefined}
              >
                <span className="relative flex size-7 items-center justify-center">
                  {active && (
                    <m.span
                      layoutId="checkout-step-halo"
                      className="absolute -inset-1 rounded-full bg-primary/10 ring-1 ring-primary/25"
                      transition={spring.smooth}
                    />
                  )}
                  <m.span
                    initial={false}
                    animate={{ scale: active ? 1 : 0.92 }}
                    transition={spring.snappy}
                    className={cn(
                      'relative flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-300',
                      done && 'bg-primary text-primary-foreground',
                      active && 'bg-primary text-primary-foreground shadow-xs',
                      !done && !active && 'border border-border bg-card text-muted-foreground',
                    )}
                  >
                    {done ? (
                      <m.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ ...spring.snappy, delay: 0.1 + i * 0.08 }}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </m.span>
                    ) : (
                      i + 1
                    )}
                  </m.span>
                </span>
                <span
                  className={cn(
                    'hidden text-sm sm:inline',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </li>
              {i < steps.length - 1 && (
                <li aria-hidden className="relative mx-3 h-px flex-1 overflow-hidden bg-border sm:mx-4">
                  <m.span
                    className="absolute inset-0 origin-left bg-primary rtl:origin-right"
                    initial={{ scaleX: i < current - 1 ? 1 : 0 }}
                    animate={{ scaleX: i < current ? 1 : 0 }}
                    transition={{ duration: 0.6, ease: ease.emerge, delay: 0.15 }}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
