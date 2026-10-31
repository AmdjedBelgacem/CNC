import type { ReactNode } from 'react';
import { ScrollProgress } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

/**
 * Long-form reading frame for the legal pages (terms, privacy, refunds).
 *
 * The documents themselves are builder layouts — headings and paragraphs
 * authored as blocks — so this frame never touches their content or structure.
 * It only sets the reading typography around them: a serif title, hairline
 * rules between clauses, a comfortable 17px/1.8 measure, and a thin clay
 * reading-progress bar along the top edge of the viewport.
 *
 * Descendant selectors (`[&_p]`) are used deliberately: they out-rank the
 * blocks' single-class utilities without editing the shared block components,
 * which also render on the marketing pages where these rules would be wrong.
 */
export function LegalDocument({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative isolate', className)}>
      <ScrollProgress className="z-[60]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] ambient-wash opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <article
        className={cn(
          // Title
          '[&_h1]:text-[clamp(2.25rem,5vw,3.5rem)] [&_h1]:leading-[1.05] [&_h1]:tracking-[-0.028em]',
          // "Last updated" line directly under the title
          '[&_h1+p]:mt-4 [&_h1+p]:text-sm [&_h1+p]:text-muted-foreground',
          // Clause headings: serif, set off by a hairline rule above
          '[&_h2]:border-t [&_h2]:border-border/70 [&_h2]:pt-10 [&_h2]:text-[1.625rem] [&_h2]:leading-snug [&_h2]:tracking-[-0.016em]',
          '[&_h3]:text-xl [&_h3]:tracking-[-0.012em]',
          // Body copy: a book-like measure
          '[&_p]:text-pretty [&_p]:text-[17px] [&_p]:leading-[1.8] [&_p]:text-foreground/80',
          '[&_li]:text-[17px] [&_li]:leading-[1.8] [&_li]:text-foreground/80',
          '[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline',
          '[&_strong]:font-semibold [&_strong]:text-foreground',
        )}
      >
        {children}
      </article>
    </div>
  );
}
