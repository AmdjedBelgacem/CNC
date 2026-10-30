import { isNodeArray, type PageLayout, type PuckNode } from '@titan/shared';
import { HOMEPAGE_FAQ } from '@/lib/faq-content';
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

const heading = (text: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('heading', {
    as: 'h2',
    text,
    size: '2xl',
    className: 'font-display font-semibold tracking-tight text-foreground sm:text-3xl',
    ...extra,
  });

const body = (text: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('text', {
    text,
    size: 'md',
    className: 'text-base leading-7 text-muted-foreground',
    ...extra,
  });

const link = (label: string, href: string, extra: Record<string, unknown> = {}): SeedNode =>
  node('link', {
    label,
    href,
    className: 'text-primary underline-offset-4 hover:underline',
    ...extra,
  });

const dot = (): SeedNode =>
  node('text', {
    text: '·',
    size: 'md',
    color: 'text-muted-foreground',
  });

const itemCard = (question: string, answer: string): SeedNode =>
  node('card', {
    padding: 'none',
    bg: 'transparent',
    radius: 'none',
    border: false,
    align: 'left',
    className: 'fixed-island-item border-b border-border pb-6',
    content: [
      heading(question, {
        as: 'h3',
        size: 'lg',
        className: 'font-display font-semibold text-foreground',
      }),
      body(answer, { className: 'mt-2 text-base leading-7 text-muted-foreground' }),
    ],
  });

const faqHeader = [heading('Frequently asked questions about CNC machining training')];
const faqItems = HOMEPAGE_FAQ.map((item) => itemCard(item.question, item.answer));

const guidesHeader = [
  heading('CNC solutions, training and practical guides'),
  body(
    'Start with our CNC training materials, then review CNC solutions, implementation guidance and partner options for your shop or learning centre.',
    { className: 'mt-3 max-w-3xl text-base leading-7 text-muted-foreground' },
  ),
  node('stack', {
    direction: 'row',
    gap: 'sm',
    align: 'center',
    justify: 'start',
    wrap: true,
    className: 'mt-4 text-base leading-7 text-muted-foreground',
    content: [
      link('CNC guides', '/learn'),
      dot(),
      link('CNC courses', '/courses'),
      dot(),
      link('CNC tools', '/products'),
      dot(),
      link('Become a partner', '/become-a-partner'),
    ],
  }),
];

const aboutHeader = [
  heading(`About ${BRAND_NAME}`),
  body(
    `${BRAND_NAME} is a manufacturing-education company. The following describes what it teaches and who it serves.`,
    { className: 'mt-3 text-base text-muted-foreground' },
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

const aboutFooter = [
  node('stack', {
    direction: 'row',
    gap: 'sm',
    align: 'center',
    justify: 'start',
    wrap: true,
    className: 'mt-8 text-sm text-muted-foreground',
    content: [
      node('text', {
        text: 'Course catalogue, academies and pricing are listed on the',
        size: 'sm',
        className: 'text-sm text-muted-foreground',
      }),
      link('courses page', '/courses', {
        className: 'underline underline-offset-4 text-muted-foreground hover:text-primary',
      }),
      node('text', {
        text: '. For cohort and institutional training, see',
        size: 'sm',
        className: 'text-sm text-muted-foreground',
      }),
      link('educational purchasing', '/edu-purchases', {
        className: 'underline underline-offset-4 text-muted-foreground hover:text-primary',
      }),
      node('text', {
        text: '.',
        size: 'sm',
        className: 'text-sm text-muted-foreground',
      }),
    ],
  }),
];

const FIXED_SEEDS: Record<string, Record<string, SeedNode[]>> = {
  'home-faq': { header: faqHeader, items: faqItems },
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
