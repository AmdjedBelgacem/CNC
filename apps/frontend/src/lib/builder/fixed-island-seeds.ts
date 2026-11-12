import { isNodeArray, type PageLayout, type PuckNode } from '@titan/shared';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Seeds for the three repository-managed islands.
 *
 * These sections are editorial content rather than tenant data, so they cannot
 * be seeded from the shared package (which must not import frontend content).
 * The builder calls this on load: every heading, paragraph, question, fact and
 * link becomes a real child block the admin can select in Layers or on the
 * canvas. Once a slot has children it is never reseeded, so edits survive.
 */

type SeedNode = PuckNode;

const node = (type: string, props: Record<string, unknown>): SeedNode => ({ type, props });

/**
 * Every class below is copied from the matching default in `home-extras.tsx`.
 * Those defaults are what production renders until a page is saved; once saved,
 * these seeds ARE production. If the two ever differ, publishing a page silently
 * restyles it — so change them together.
 */
const TITLE =
  'text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl';
const LEAD = 'mt-4 text-pretty text-base leading-7 text-muted-foreground';
const ITEM_TITLE =
  'text-balance font-display text-xl font-medium tracking-[-0.012em] text-foreground';
const ITEM_BODY = 'mt-3 text-pretty text-base leading-7 text-muted-foreground';

const heading = (text: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('heading', {
    as: 'h2',
    text,
    size: '2xl',
    className: TITLE,
    ...extra,
  });

const body = (text: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('text', {
    text,
    size: 'plain',
    className: LEAD,
    ...extra,
  });

const link = (label: string, href: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('link', {
    label,
    href,
    className: 'text-primary underline-offset-4 hover:underline',
    ...extra,
  });

const itemCard = (question: string, answer: string): SeedNode =>
  node('card', {
    padding: 'none',
    bg: 'transparent',
    radius: 'none',
    border: false,
    align: 'left',
    className: 'fixed-island-item border-b border-border/70 pb-8',
    content: [
      heading(question, { as: 'h3', size: 'xl', className: ITEM_TITLE }),
      body(answer, { className: ITEM_BODY }),
    ],
  });


/** One pill, matching the public guides card (`link-pill` with its trailing arrow). */
const guidePill = (label: string, href: string): SeedNode =>
  node('link', { label, href, arrow: true, className: 'link-pill group' });

const guidesHeader = [
  node('card', {
    padding: 'none',
    bg: 'transparent',
    radius: '3xl',
    border: true,
    align: 'left',
    className:
      'ambient-wash-card relative overflow-hidden bg-card px-6 py-12 shadow-xs sm:px-12 md:py-14',
    content: [
      heading('CNC solutions, training and practical guides', { className: `max-w-2xl ${TITLE}` }),
      body(
        'Start with our CNC training materials, then review CNC solutions, implementation guidance and partner options for your shop or learning centre.',
        { className: `max-w-2xl ${LEAD}` },
      ),
      node('stack', {
        direction: 'row',
        gap: 'sm',
        align: 'start',
        justify: 'start',
        wrap: true,
        className: 'mt-8',
        content: [
          guidePill('CNC guides', '/learn'),
          guidePill('CNC courses', '/courses'),
          guidePill('CNC tools', '/products'),
          guidePill('Become a partner', '/become-a-partner'),
        ],
      }),
    ],
  }),
];

const aboutHeader = [
  heading(`About ${BRAND_NAME}`),
  body(
    `${BRAND_NAME} is a manufacturing-education company. The following describes what it teaches and who it serves.`,
  ),
];

const aboutFacts = [
  {
    heading: `What ${BRAND_NAME} does`,
    body: `${BRAND_NAME} provides CNC machining education. Courses are simulation-first: learners practise tooling, workholding, feeds and speeds on a digital twin of a machine before cutting real metal, so they can build tolerance and fixturing intuition without consuming machine time or scrap.`,
  },
  {
    heading: 'Who the courses are for',
    body: 'The training is aimed at machinists moving from manual work to CNC, engineers who need to communicate with the shop floor, and production teams standardising setup, programming and inspection practice. Each course states its difficulty level and prerequisites before enrolment.',
  },
  {
    heading: 'How courses are structured',
    body: 'Material is organised into academies and delivered as self-paced courses, each combining video instruction, downloadable CAD and process sheets, knowledge checks, and a completion certificate. Courses are available in English and Arabic.',
  },
  {
    heading: 'Standards and recognition',
    body: 'Completion certificates record the course, competency level and date of completion. They are intended as evidence of training and are not a substitute for a formal engineering or trade qualification.',
  },
];

const aboutItems = aboutFacts.map((fact) => itemCard(fact.heading, fact.body));

/** Footer sentence. Spaces are non-breaking so the flex row keeps the sentence's word gaps. */
const footerText = (text: string): SeedNode =>
  node('text', { text, size: 'plain', className: 'text-sm leading-6 text-muted-foreground' });

const aboutFooter = [
  node('stack', {
    direction: 'row',
    gap: 'none',
    align: 'start',
    justify: 'start',
    wrap: true,
    className: 'mt-10',
    content: [
      footerText('Course catalogue, academies and pricing are listed on the '),
      link('courses page', '/courses', { className: 'text-sm leading-6 text-primary underline-offset-4 hover:underline' }),
      footerText('. For cohort and institutional training, see '),
      link('educational purchasing', '/edu-purchases', { className: 'text-sm leading-6 text-primary underline-offset-4 hover:underline' }),
      footerText('.'),
    ],
  }),
];

const FIXED_SEEDS: Record<string, Record<string, SeedNode[]>> = {
  // The homepage FAQ is not seeded: it renders the same accordion component in the builder and on
  // the public page, in the visitor's language. Seeding it as blocks made the canvas show English
  // cards while visitors saw an Arabic accordion.
  'home-guides': { header: guidesHeader },
  'about-facts': { header: aboutHeader, items: aboutItems, footer: aboutFooter },
};

/** Adds the fixed-island child blocks once; existing authored slots win. */
export function seedFixedLiveIslands(layout: PageLayout): PageLayout {
  let changed = false;
  const content = (layout.content ?? []).map((node) => {
    if (node.type !== 'live-island') return node;
    const variant = typeof node.props?.variant === 'string' ? node.props.variant : '';
    const seeds = FIXED_SEEDS[variant];
    if (!seeds) return node;
    const props: Record<string, unknown> = { ...(node.props ?? {}) };
    let nodeChanged = false;
    for (const [slot, children] of Object.entries(seeds)) {
      if (isNodeArray(props[slot])) continue;
      props[slot] = structuredClone(children);
      nodeChanged = true;
    }
    if (!nodeChanged) return node;
    changed = true;
    return { type: node.type, props };
  });
  return changed ? { ...layout, content } : layout;
}
