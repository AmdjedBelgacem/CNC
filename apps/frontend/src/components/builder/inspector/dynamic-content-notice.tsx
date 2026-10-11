'use client';

import { Database, ExternalLink } from 'lucide-react';

/**
 * Blocks whose visible content comes from live records rather than authored copy.
 *
 * Some blocks render what is actually in the catalogue — how many academies are published, which
 * sponsors exist, the current courses. Editing text on the block would be a lie: the next render
 * overwrites it. Previously these blocks showed either an empty inspector or a set of props that
 * looked editable but had no effect, with nothing to say why.
 *
 * The notice tells the editor where the content actually lives instead.
 */
const DYNAMIC_BLOCKS: Record<string, { source: string; href?: string }> = {
  'academy-grid': { source: 'Academies', href: '/admin/academies' },
  'program-cards': { source: 'Courses', href: '/admin/courses' },
  testimonials: { source: 'Courses and testimonials', href: '/admin/courses' },
  'partner-logos': { source: 'Sponsors', href: '/admin' },
  'catalog-hero': { source: 'The live catalogue', href: '/admin/products' },
  'live-island': { source: 'Live workspace data', href: '/admin' },
};

export function isDynamicBlock(type: string): boolean {
  return type in DYNAMIC_BLOCKS;
}

export function DynamicContentNotice({ type }: { type: string }) {
  const entry = DYNAMIC_BLOCKS[type];
  if (!entry) return null;
  return (
    <div className="border-b border-border bg-info/5 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-info">
        <Database className="size-3.5 shrink-0" aria-hidden />
        Dynamic content
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
        This block renders live records from{' '}
        <span className="font-medium text-foreground">{entry.source}</span>, so its text and numbers
        update on their own and cannot be typed here. Edit the source records to change what it
        shows.
      </p>
      {entry.href ? (
        <a
          href={entry.href}
          className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-primary hover:underline"
        >
          Manage {entry.source.toLowerCase()}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
