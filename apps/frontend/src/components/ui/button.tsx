import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.005em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline:
          'border border-border bg-card text-foreground shadow-xs hover:border-border-strong hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/85',
        accent: 'bg-accent text-accent-foreground shadow-xs hover:bg-accent/90',
        ghost: 'text-foreground hover:bg-muted',
        subtle: 'bg-muted text-foreground hover:bg-muted/70',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-7 rounded-sm px-2 text-xs',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-11 px-6',
        xl: 'h-12 px-8 text-base',
        // Icon buttons: the hit area stays generous while the GLYPH is sized down,
        // so the icon has real breathing room instead of sitting edge-to-edge.
        // Contexts: `icon` = nav/toolbar actions, `icon-sm` = dense toolbars,
        // `icon-xs` = table row actions.
        icon: 'h-10 w-10 [&_svg]:size-[18px]',
        'icon-sm': 'h-9 w-9 [&_svg]:size-4',
        'icon-xs': 'size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    // `asChild` previously rendered children bare, silently dropping every variant
    // class — callers like <Button variant="ghost" size="icon" asChild><Link/></Button>
    // produced a completely unstyled link. Slot merges the classes onto the child.
    if (asChild) {
      // Slot requires exactly ONE element child. This codebase is formatted with
      // `{' '}` whitespace nodes, so `<Button asChild>{' '}<Link/></Button>` passes two
      // children and Slot throws "React.Children.only expected a single child" —
      // which 500'd whole pages. Drop whitespace-only strings before handing over.
      const kids = React.Children.toArray(children).filter(
        (child) => !(typeof child === 'string' && child.trim() === ''),
      );
      if (kids.length === 1) {
        return (
          <Slot ref={ref} className={classes} {...props}>
            {kids[0]}
          </Slot>
        );
      }
      // Genuinely multi-child (or no child) — wrap instead of crashing.
      return (
        <span className={classes} {...props}>
          {children}
        </span>
      );
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        data-loading={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <span
              aria-hidden
              className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
            />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
