'use client';

import { Database, ExternalLink, EyeOff } from 'lucide-react';
import { useOpenPage } from '@/components/builder/use-open-page';

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
const DYNAMIC_BLOCKS: Record<string, { source: string; href?: string; homeOnly?: boolean }> = {
  'academy-grid': { source: 'Academies', href: '/admin/academies' },
  'program-cards': { source: 'Courses', href: '/admin/courses' },
  'partner-logos': { source: 'Sponsors', href: '/admin' },
  'catalog-hero': { source: 'The live catalogue', href: '/admin/products' },
  stats: { source: 'Academy and course counts', href: '/admin/academies', homeOnly: true },
  'avatar-stack': { source: 'Academy enrollment', href: '/admin/academies', homeOnly: true },
  'cta-signup': { source: 'Academy and course counts', href: '/admin/academies', homeOnly: true },
  text: { source: 'Academy enrollment', href: '/admin/academies', homeOnly: true },
  'live-island': { source: 'Live workspace data', href: '/admin' },
};

/**
 * Seed testimonials have no public data source. The homepage renderer drops
 * them, so a canvas that still showed the fake cards would be a lie. Show the
 * warning on the only page that drops them; other pages may still author them.
 */
const HIDDEN_ON_HOME = new Set(['testimonials', 'testimonial-card']);

export function isDynamicBlock(type: string): boolean {
  return type in DYNAMIC_BLOCKS || HIDDEN_ON_HOME.has(type);
}

export function DynamicContentNotice({
  type,
  props,
}: {
  type: string;
  props?: Record<string, unknown>;
}) {
  const { slug } = useOpenPage();
  const onHome = slug === 'home';

  if (onHome && HIDDEN_ON_HOME.has(type)) {
    return (
      <div className="border-b border-border bg-warning/10 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-warning">
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
          Hidden on the homepage
        </p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
          There is no public testimonials source, so the live homepage hides this block and its
          cards. Remove it, or use a <span className="font-medium text-foreground">Live island</span>{' '}
          section for content that visitors actually see.
        </p>
      </div>
    );
  }

  const entry = DYNAMIC_BLOCKS[type];
  if (!entry) return null;
  if (entry.homeOnly && !onHome) return null;
  // Only the hero trust-note text is replaced on the homepage; every other text
  // block is authored copy and should not show a dynamic-content notice.
  if (type === 'text') {
    const text = typeof props?.text === 'string' ? props.text : '';
    if (!text.includes('17,400')) return null;
  }
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
