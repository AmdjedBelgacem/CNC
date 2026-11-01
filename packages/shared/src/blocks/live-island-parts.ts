import type { PuckNode } from '../types/page';
import { ISLAND_HEAD } from '../constants/island-style';

/**
 * Static header trees for the live-data islands.
 *
 * A `live-island` used to be one opaque node: the public component rendered the
 * section heading, the supporting copy and the live rows, and the builder could
 * only show an iframe of that component. That made the visible heading and
 * description impossible to select on the canvas.
 *
 * The island now owns a real `header` slot. These seeds are the English copy
 * that used to live inside the component. They are ordinary `heading`, `text`,
 * `link`, `stack`, `grid` and `card` nodes, so the editor can select, move and
 * edit each one. The public island components fall back to their translated
 * header when the slot is empty, which keeps the Arabic pages on their existing
 * translated copy.
 */

type NodeProps = Record<string, unknown>;
type SeedNode = PuckNode;

const withId = (id: string | undefined, props: NodeProps): NodeProps =>
  id ? { ...props, id } : props;

const node = (type: string, props: NodeProps): SeedNode => ({ type, props });

const text = (
  id: string | undefined,
  value: string,
  extra: NodeProps = {},
): SeedNode =>
  node(
    'text',
    withId(id, {
      text: value,
      // `eyebrow` is the same sans label (with its clay dot) the public islands print.
      size: 'eyebrow',
      className: ISLAND_HEAD.eyebrow,
      ...extra,
    }),
  );

const body = (
  id: string | undefined,
  value: string,
  extra: NodeProps = {},
): SeedNode =>
  node(
    'text',
    withId(id, {
      text: value,
      // `plain` adds no type classes, so the paragraph styling below is exactly
      // what the public island prints.
      size: 'plain',
      className: ISLAND_HEAD.lead,
      ...extra,
    }),
  );

const heading = (
  id: string | undefined,
  value: string,
  extra: NodeProps = {},
): SeedNode =>
  node(
    'heading',
    withId(id, {
      as: 'h2',
      text: value,
      size: '2xl',
      className: ISLAND_HEAD.titleLg,
      ...extra,
    }),
  );

const link = (
  id: string | undefined,
  label: string,
  href: string,
  extra: NodeProps = {},
): SeedNode =>
  node(
    'link',
    withId(id, {
      label,
      href,
      arrow: true,
      className: ISLAND_HEAD.pillLink,
      ...extra,
    }),
  );

const stack = (
  id: string | undefined,
  content: SeedNode[],
  extra: NodeProps = {},
): SeedNode =>
  node(
    'stack',
    withId(id, {
      direction: 'column',
      gap: 'sm',
      align: 'start',
      justify: 'start',
      ...extra,
      content,
    }),
  );

const grid = (
  id: string | undefined,
  content: SeedNode[],
  extra: NodeProps = {},
): SeedNode =>
  node(
    'grid',
    withId(id, {
      columns: 3,
      gap: 'sm',
      ...extra,
      items: content,
    }),
  );

const card = (
  id: string | undefined,
  content: SeedNode[],
  extra: NodeProps = {},
): SeedNode =>
  node(
    'card',
    withId(id, {
      padding: 'sm',
      bg: 'glass',
      radius: 'lg',
      border: true,
      align: 'left',
      ...extra,
      content,
    }),
  );

const trustCard = (id: string | undefined, title: string, hint: string): SeedNode =>
  card(
    id,
    [
      heading(id ? `${id}-title` : undefined, title, {
        as: 'h3',
        size: 'sm',
        className: 'font-sans text-sm font-semibold text-foreground',
      }),
      body(id ? `${id}-hint` : undefined, hint, {
        className: 'mt-0.5 text-xs leading-snug text-muted-foreground',
      }),
    ],
    {
      padding: 'none',
      bg: 'transparent',
      radius: 'xl',
      border: true,
      className: 'bg-card px-4 py-3.5 shadow-xs',
    },
  );

function headerFor(variant: string, baseId: string | undefined): SeedNode[] | null {
  const id = (key: string) => (baseId ? `${baseId}-header-${key}` : undefined);

  /** Eyebrow over a title: the plain block the public islands print. */
  const copy = (children: SeedNode[], extra: NodeProps = {}) =>
    stack(id('copy'), children, { gap: 'none', ...extra });

  switch (variant) {
    case 'products-featured':
      return [
        stack(
          id('root'),
          [
            copy([
              text(id('eyebrow'), 'On the bench'),
              heading(id('title'), 'Featured this week'),
            ]),
            link(id('link'), 'Full catalog', '#inventory'),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-10',
          },
        ),
      ];

    case 'products-inventory':
      return [
        // A grid, not a row stack: one column below `lg`, copy + trust strip from `lg`.
        // Grid items follow the same rules whether they are the blocks themselves
        // (production) or the wrappers around them (builder canvas); a wrapping flex
        // row does not, and squeezed the copy column to a few pixels on mobile.
        grid(
          id('root'),
          [
            copy(
              [
                text(id('eyebrow'), 'Live inventory'),
                heading(id('title'), 'Shop the catalog', {
                  size: 'section',
                  className: 'section-title mt-3',
                }),
                body(
                  id('body'),
                  'Every template, calculator and shop resource we publish — filter by department, availability, format and price to find what you need.',
                  { className: ISLAND_HEAD.leadSm },
                ),
              ],
              { className: 'max-w-2xl lg:min-w-[380px]' },
            ),
            grid(
              id('trust'),
              [
                trustCard(id('trust-shipping'), 'Free shipping', 'On orders over $99'),
                trustCard(id('trust-instant'), 'Instant delivery', 'Digital products land in your inbox after checkout.'),
                trustCard(id('trust-support'), 'Support', 'Questions before you buy?'),
              ],
              { className: 'w-full max-w-full' },
            ),
          ],
          {
            columns: 1,
            gap: 'lg',
            className:
              'mb-10 items-end border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-10',
          },
        ),
      ];

    case 'products-departments':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Directory'),
            heading(id('title'), 'Shop by department', {
              size: 'section',
              className: 'section-title mt-3',
            }),
            body(id('body'), 'Jump straight to the tools for your workflow.', {
              className: ISLAND_HEAD.leadSm,
            }),
          ],
          { gap: 'none', align: 'start', className: 'mb-10 max-w-2xl' },
        ),
      ];

    case 'academy-pathways':
      return [
        stack(
          id('root'),
          [
            copy([
              text(id('eyebrow'), 'Directory'),
              heading(id('title'), 'Choose your academy', { className: ISLAND_HEAD.titleXl }),
            ]),
            body(
              id('blurb'),
              'Each pathway is a full curriculum — start anywhere, switch anytime, keep your progress.',
              { className: ISLAND_HEAD.aside },
            ),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-10',
          },
        ),
      ];

    case 'events-next-up':
      return [
        stack(
          id('root'),
          [
            copy([
              text(id('eyebrow'), 'Next on the board'),
              heading(id('title'), "Don't miss the next one", { className: ISLAND_HEAD.titleMd }),
            ]),
            link(id('link'), 'Full board', '#browse', { className: ISLAND_HEAD.textLink }),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-8',
          },
        ),
      ];

    case 'events-schedule':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Schedule'),
            heading(id('title'), "What's coming up"),
            body(
              id('body'),
              'Ordered by date — workshops, webinars, and meets as they land on the board.',
            ),
          ],
          { gap: 'none', align: 'start', className: 'mb-8 max-w-2xl' },
        ),
      ];

    case 'events-browse':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Full board'),
            heading(id('title'), 'Browse every event'),
            body(
              id('body'),
              'Filter by format, toggle upcoming vs past, search by city or title — live from the events API.',
            ),
          ],
          { gap: 'none', align: 'start', className: 'mb-8 max-w-2xl' },
        ),
      ];

    case 'feed-topics':
      return [
        stack(
          id('root'),
          [
            copy([
              text(id('eyebrow'), 'Topics on the wire'),
              heading(id('title'), 'What the shop is tagging', { className: ISLAND_HEAD.titleMd }),
            ]),
            body(
              id('hint'),
              'Tags pulled from live posts — scroll the wire below for full context.',
              { className: ISLAND_HEAD.aside },
            ),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-8',
          },
        ),
      ];

    case 'feed-wire':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Live wire'),
            heading(id('title'), 'The feed, unfiltered'),
            body(
              id('body'),
              'Discover public posts from the floor — like, comment, or drop your own setup.',
            ),
          ],
          { gap: 'none', align: 'start', className: 'mb-8 max-w-2xl' },
        ),
      ];

    default:
      return null;
  }
}

/**
 * Returns the default header nodes for a live-island variant.
 *
 * `baseId` is the live-island node id. Every seeded child gets a deterministic
 * id derived from it, so a translated page can match the same header nodes on
 * subsequent loads instead of accumulating duplicates.
 */
export function liveIslandHeaderSeed(
  variant: string | undefined,
  baseId: string | undefined,
): SeedNode[] | null {
  if (!variant) return null;
  return headerFor(variant, baseId);
}
