import type { PuckNode } from '../types/page';

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
      size: 'sm',
      uppercase: true,
      tracking: '0.1em',
      weight: 'semibold',
      color: 'text-primary',
      className: 'font-mono',
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
      size: 'md',
      color: 'text-muted-foreground',
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
      leading: 'tight',
      className: 'font-display font-bold text-foreground',
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
      className:
        'font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary whitespace-nowrap',
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
  card(id, [
    heading(id ? `${id}-title` : undefined, title, {
      as: 'h3',
      size: 'sm',
      className: 'font-display text-sm font-semibold text-foreground',
    }),
    body(id ? `${id}-hint` : undefined, hint, {
      size: 'sm',
      className: 'font-mono text-[11px] leading-snug text-muted-foreground',
    }),
  ]);

function headerFor(variant: string, baseId: string | undefined): SeedNode[] | null {
  const id = (key: string) => (baseId ? `${baseId}-header-${key}` : undefined);

  switch (variant) {
    case 'products-featured':
      return [
        stack(
          id('root'),
          [
            stack(id('copy'), [
              text(id('eyebrow'), 'On the bench'),
              heading(id('title'), 'Featured this week', {
                size: '2xl',
                className:
                  'mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl',
              }),
            ]),
            link(id('link'), 'Full catalog', '#inventory'),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-6',
          },
        ),
      ];

    case 'products-inventory':
      return [
        stack(
          id('root'),
          [
            stack(
              id('copy'),
              [
                text(id('eyebrow'), 'Live inventory'),
                heading(id('title'), 'Shop the catalog', {
                  size: '2xl',
                  className:
                    'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
                }),
                body(
                  id('body'),
                  'Every template, calculator and shop resource we publish — filter by department, availability, format and price to find what you need.',
                ),
              ],
              { className: 'max-w-2xl lg:min-w-[380px] lg:flex-1' },
            ),
            grid(
              id('trust'),
              [
                trustCard(id('trust-shipping'), 'Free shipping', 'On orders over $99'),
                trustCard(id('trust-instant'), 'Instant delivery', 'Digital products land in your inbox after checkout.'),
                trustCard(id('trust-support'), 'Support', 'Questions before you buy?'),
              ],
              { className: 'max-w-full shrink-0 lg:w-[600px]' },
            ),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'lg',
            className: 'mb-8 border-b border-border pb-8',
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
              size: '2xl',
              className:
                'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
            }),
            body(id('body'), 'Jump straight to the tools for your workflow.'),
          ],
          { className: 'mb-8 max-w-2xl' },
        ),
      ];

    case 'academy-pathways':
      return [
        stack(
          id('root'),
          [
            stack(id('copy'), [
              text(id('eyebrow'), 'Directory'),
              heading(id('title'), 'Choose your academy', {
                size: '2xl',
                className:
                  'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
              }),
            ]),
            body(
              id('blurb'),
              'Each pathway is a full curriculum — start anywhere, switch anytime, keep your progress.',
              { className: 'max-w-sm text-sm' },
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

    case 'events-next-up':
      return [
        stack(
          id('root'),
          [
            stack(id('copy'), [
              text(id('eyebrow'), 'Next on the board'),
              heading(id('title'), "Don't miss the next one", {
                size: '2xl',
                className:
                  'mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl',
              }),
            ]),
            link(id('link'), 'Full board', '#browse'),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-6',
          },
        ),
      ];

    case 'events-schedule':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Schedule'),
            heading(id('title'), "What's coming up", {
              size: '2xl',
              className:
                'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
            }),
            body(
              id('body'),
              'Ordered by date — workshops, webinars, and meets as they land on the board.',
            ),
          ],
          { className: 'mb-6 max-w-2xl' },
        ),
      ];

    case 'events-browse':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Full board'),
            heading(id('title'), 'Browse every event', {
              size: '2xl',
              className:
                'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
            }),
            body(
              id('body'),
              'Filter by format, toggle upcoming vs past, search by city or title — live from the events API.',
            ),
          ],
          { className: 'mb-6 max-w-2xl' },
        ),
      ];

    case 'feed-topics':
      return [
        stack(
          id('root'),
          [
            stack(id('copy'), [
              text(id('eyebrow'), 'Topics on the wire'),
              heading(id('title'), 'What the shop is tagging', {
                size: '2xl',
                className:
                  'mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl',
              }),
            ]),
            body(
              id('hint'),
              'Tags pulled from live posts — scroll the wire below for full context.',
              { className: 'max-w-sm text-sm' },
            ),
          ],
          {
            direction: 'row',
            align: 'end',
            justify: 'between',
            wrap: true,
            gap: 'md',
            className: 'mb-6',
          },
        ),
      ];

    case 'feed-wire':
      return [
        stack(
          id('root'),
          [
            text(id('eyebrow'), 'Live wire'),
            heading(id('title'), 'The feed, unfiltered', {
              size: '2xl',
              className:
                'mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl',
            }),
            body(
              id('body'),
              'Discover public posts from the floor — like, comment, or drop your own setup.',
            ),
          ],
          { className: 'mb-6 max-w-2xl' },
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
