/**
 * Single source of truth for the live-island chrome.
 *
 * A live island has two renderers: the public server component (production) and
 * the builder canvas, which draws the header from editable blocks seeded in
 * `blocks/live-island-parts.ts`. They used to hold separate copies of these class
 * strings, and every restyle drifted one of them — so the builder showed a section
 * with different padding and a different title than the site it publishes to.
 *
 * Both sides now read from here. Keep every class a complete literal (never build
 * one with string concatenation) so Tailwind can find it in the scanned source.
 */

export interface IslandPad {
  /** Vertical padding of the public `<section>`. */
  section: string;
  /** Top-only counterpart: the builder draws the header block above the body iframe. */
  top: string;
  /** Bottom-only counterpart, for islands the builder renders in-page. */
  bottom: string;
}

const PAD_24: IslandPad = {
  section: 'py-16 md:py-24',
  top: 'pt-16 md:pt-24',
  bottom: 'pb-16 md:pb-24',
};
const PAD_20: IslandPad = {
  section: 'py-16 md:py-20',
  top: 'pt-16 md:pt-20',
  bottom: 'pb-16 md:pb-20',
};

export const ISLAND_PAD = {
  'products-featured': PAD_24,
  'products-inventory': PAD_24,
  'products-departments': PAD_24,
  'academy-pathways': PAD_24,
  'feed-topics': PAD_20,
  'feed-wire': PAD_24,
  'events-next-up': PAD_20,
  'events-schedule': PAD_24,
  'events-browse': PAD_24,
} as const satisfies Readonly<Record<string, IslandPad>>;

/** Type and spacing for island headers. */
export const ISLAND_HEAD = {
  /**
   * Eyebrow label (sans, clay dot). `flex` makes it block-level: as an inline-flex child
   * of a plain div it carries a line-box strut that a flex item does not, which made the
   * default header taller than the same header seeded as blocks. Not `w-fit`: combined
   * with the text block's `overflow-wrap:anywhere` it collapses to a few pixels wide.
   */
  eyebrow: 'eyebrow flex',
  /** Title under an eyebrow, medium (feed topics, next up, featured). */
  titleMd:
    'mt-3 text-balance font-display text-2xl font-medium tracking-[-0.018em] text-foreground md:text-3xl',
  /** Title under an eyebrow, large (schedule, browse, wire, departments). */
  titleLg:
    'mt-3 text-balance font-display text-3xl font-medium tracking-[-0.02em] text-foreground md:text-4xl',
  /** Academy directory title. */
  titleXl:
    'mt-3 text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground md:text-5xl',
  /** Supporting paragraph under a large title. */
  lead: 'mt-3 max-w-prose leading-relaxed text-muted-foreground',
  /** Supporting paragraph used by the catalog/department headers. */
  leadSm: 'mt-4 max-w-prose text-[15px] leading-relaxed text-muted-foreground',
  /** Side note aligned to the right of a title row. */
  aside: 'max-w-sm text-sm leading-relaxed text-muted-foreground',
  /** Text link beside a title (events "Full board"). */
  textLink: 'group inline-flex min-h-6 items-center gap-1 text-sm font-medium text-primary hover:underline',
  /** Pill link beside a title (products "Full catalog"). */
  pillLink: 'link-pill group',
} as const;
