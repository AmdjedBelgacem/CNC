import type { PageLayout } from '../types/page';
import { leaf, pack, packMulti } from '../blocks/seeds';
import type { SeedResult } from '../blocks/registry';

/**
 * Starting layouts for pages an admin creates.
 *
 * A blank page is a trap: the editor opens on an empty canvas with no hint of
 * what to do next, and a first-time author usually abandons it. `landing` and
 * `content` give a real, deletable skeleton — every node here is an ordinary
 * block the author can remove, not scaffolding the renderer depends on.
 *
 * Prop values are taken from the block schemas (`headingPropsSchema.size`,
 * `buttonPropsSchema.variant`, the declared slot names), not from memory: an
 * invented enum member makes the page unpublishable, and the failure only shows
 * up at publish time. `templates.spec.ts` validates all three against the real
 * registry so that cannot regress.
 */

function section(
  id: string,
  className: string,
  paddingTop: number,
  paddingBottom: number,
  children: SeedResult[],
) {
  return pack({ type: 'section', props: { id, className, paddingTop, paddingBottom } }, 'content', children);
}

function container(id: string, children: SeedResult[], extra = 'container mx-auto px-4') {
  return pack(
    {
      type: 'stack',
      props: { id, direction: 'column', gap: 'lg', align: 'stretch', justify: 'start', className: extra },
    },
    'content',
    children,
  );
}

function card(id: string, title: string, body: string): SeedResult {
  return pack({ type: 'card', props: { id, className: '' } }, 'content', [
    leaf('heading', { as: 'h3', size: 'lg', text: title, marginBottom: 8 }),
    leaf('text', { text: body, size: 'sm', color: 'text-text-muted' }),
  ]);
}

/** Hero + value props + closing CTA. A reasonable marketing page. */
export function seedLandingTemplate(): PageLayout {
  const hero = section('lp-hero', 'border-b bg-surface-sunken/60 blueprint-grid', 96, 72, [
    container('lp-hero-inner', [
      leaf('heading', {
        id: 'lp-hero-heading',
        as: 'h1',
        size: 'headline-lg',
        text: 'Your headline goes here',
        align: 'center',
        marginBottom: 16,
      }),
      leaf('text', {
        id: 'lp-hero-text',
        text: 'One or two sentences on what this page is for and who it is for.',
        size: 'lg',
        color: 'text-text-muted',
        align: 'center',
        maxWidth: 672,
        className: 'mx-auto',
      }),
      leaf('button', {
        id: 'lp-hero-cta',
        label: 'Get started',
        variant: 'primary',
        size: 'lg',
        href: '#',
      }),
    ]),
  ]);

  // `stats` only accepts `stat-item` children, so an empty stats bar is not a
  // useful starting point — it is seeded with three editable figures.
  const stats = pack(
    { type: 'stats', props: { id: 'lp-stats', className: '' } },
    'content',
    [
      { id: 'lp-stat-1', value: '100%', label: 'Free access' },
      { id: 'lp-stat-2', value: '500k+', label: 'Makers taught' },
      { id: 'lp-stat-3', value: '120+', label: 'Courses' },
    ].map((stat) =>
      pack({ type: 'stat-item', props: { id: stat.id } }, 'content', [
        leaf('heading', { id: `${stat.id}-v`, as: 'h3', size: 'stats', text: stat.value }),
        leaf('text', { id: `${stat.id}-l`, text: stat.label, size: 'sm', color: 'text-text-muted' }),
      ]),
    ),
  );

  // `grid`'s slot is `items`, not `content`.
  const body = section('lp-body', 'bg-secondary/10', 72, 72, [
    container('lp-body-inner', [
      leaf('heading', { id: 'lp-body-h2', as: 'h2', size: 'headline-md', text: 'What we offer', align: 'center', marginBottom: 24 }),
      pack(
        { type: 'grid', props: { id: 'lp-grid', columns: 3, gap: 'lg', className: '' } },
        'items',
        [
          card('lp-card-1', 'First item', 'Describe this item in a sentence.'),
          card('lp-card-2', 'Second item', 'Describe this item in a sentence.'),
          card('lp-card-3', 'Third item', 'Describe this item in a sentence.'),
        ],
      ),
    ]),
  ]);

  const cta = section('lp-cta', 'border-t', 64, 96, [
    container('lp-cta-inner', [
      leaf('heading', { id: 'lp-cta-h2', as: 'h2', size: 'headline-md', text: 'Ready to start?', align: 'center', marginBottom: 16 }),
      leaf('text', { id: 'lp-cta-text', text: 'Close the page with a clear next step.', size: 'md', color: 'text-text-muted', align: 'center' }),
      leaf('button', { id: 'lp-cta-btn', label: 'Contact us', variant: 'white-outline', size: 'lg', href: '#' }),
    ]),
  ]);

  return {
    root: { props: {} },
    content: [hero.node, stats.node, body.node, cta.node],
    schemaVersion: 2,
  };
}

/** Title + prose + FAQ. A readable article or policy page. */
export function seedContentTemplate(): PageLayout {
  const head = section('cp-head', 'border-b', 64, 40, [
    container('cp-head-inner', [
      leaf('heading', { id: 'cp-title', as: 'h1', size: 'headline-lg', text: 'Page title', marginBottom: 12 }),
      leaf('text', { id: 'cp-summary', text: 'A short summary shown under the title.', size: 'lg', color: 'text-text-muted' }),
    ]),
  ]);

  const body = section('cp-body', '', 48, 48, [
    container('cp-body-inner', [
      leaf('heading', { id: 'cp-h2', as: 'h2', size: 'xl', text: 'Section heading', marginBottom: 12 }),
      leaf('text', { id: 'cp-p1', text: 'Write the section here. Every paragraph is a separate text block, so it can be styled and reordered on its own.', size: 'md' }),
      leaf('text', { id: 'cp-p2', text: 'A second paragraph, for when the first one needs to be shorter.', size: 'md' }),
    ]),
  ]);

  // `faq` declares `header` and `items`, each with its own allowed children, and
  // `faq-item` caps `toggle`/`content` at one child each.
  const faq = section('cp-faq', 'bg-secondary/10', 48, 72, [
    container('cp-faq-inner', [
      pack(
        { type: 'faq', props: { id: 'cp-faq-list' } },
        'items',
        [
          packMulti(
            { type: 'faq-item', props: { id: 'cp-faq-1', question: 'What is this page about?' } },
            {
              toggle: [leaf('text', { id: 'cp-faq-1-q', text: 'The short answer.', size: 'sm' })],
              content: [leaf('text', { id: 'cp-faq-1-a', text: 'The longer answer goes here.', size: 'md' })],
            },
          ),
          packMulti(
            { type: 'faq-item', props: { id: 'cp-faq-2', question: 'How do I edit this?' } },
            {
              toggle: [leaf('text', { id: 'cp-faq-2-q', text: 'Select any block in the builder.', size: 'sm' })],
              content: [leaf('text', { id: 'cp-faq-2-a', text: 'The inspector on the right edits whatever is selected.', size: 'md' })],
            },
          ),
        ],
      ),
    ]),
  ]);

  return {
    root: { props: {} },
    content: [head.node, body.node, faq.node],
    schemaVersion: 2,
  };
}

/** Empty on purpose. */
export function seedBlankTemplate(): PageLayout {
  return { root: { props: {} }, content: [], schemaVersion: 2 };
}

export const PAGE_TEMPLATE_SEEDS: Record<string, () => PageLayout> = {
  blank: seedBlankTemplate,
  landing: seedLandingTemplate,
  content: seedContentTemplate,
};

/** A layout for a newly created page, chosen by template name. */
export function getTemplateLayout(template: string | null | undefined): PageLayout {
  const seed = PAGE_TEMPLATE_SEEDS[template ?? 'blank'] ?? PAGE_TEMPLATE_SEEDS.blank!;
  return seed();
}

/** Named alias used by seeds and backfills; same output as `getTemplateLayout`. */
export const seedTemplateFor = getTemplateLayout;
