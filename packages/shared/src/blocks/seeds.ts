import type { PageLayout, PuckNode } from '../types/page';
import type { SeedFn, SeedResult } from './registry';
import { BLOCK_REGISTRY } from './registry';
import { heroDefaults, ctaBannerDefaults } from './registry';

// ------------------------------------------------------------------
// Node builders — every generated id is unique per call so copies can
// never collide with the source or with each other.
// ------------------------------------------------------------------

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A bare node with a fresh id. */
export function n(type: string, props: Record<string, unknown> = {}): PuckNode {
  return { type, props: { ...props, id: newId() } };
}

/** A leaf node (no slot children). */
export function leaf(type: string, props: Record<string, unknown> = {}): SeedResult {
  return { node: n(type, props) };
}

/** Wraps a node with one slot containing the given child subtrees (inline). */
export function pack(parent: PuckNode, zone: string, children: SeedResult[]): SeedResult {
  return packMulti(parent, { [zone]: children });
}

/** Wraps a node with several named slots (e.g. faq-item's toggle + content). */
export function packMulti(parent: PuckNode, zonesIn: Record<string, SeedResult[]>): SeedResult {
  const props: Record<string, unknown> = { ...(parent.props ?? {}) };
  for (const [zone, children] of Object.entries(zonesIn)) {
    props[zone] = children.map((child) => child.node);
  }
  return { node: { type: parent.type, props } };
}

function pick(props: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out;
}

function itemsOf(overrides: Record<string, unknown>): Record<string, unknown>[] | undefined {
  return Array.isArray(overrides.items) ? (overrides.items as Record<string, unknown>[]) : undefined;
}

// ------------------------------------------------------------------
// Navbar
// ------------------------------------------------------------------

export interface NavLinkItem {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLinkItem[] = [
  { label: 'Academies', href: '/academy' },
  { label: 'Toolkits', href: '/products' },
  { label: 'Resources', href: '/feed' },
  { label: 'Pricing', href: '/products' },
];

export function seedNav(overrides: { logo?: string; links?: NavLinkItem[] } = {}): SeedResult {
  const logo = overrides.logo ?? 'Ahmad CNC';
  const links = overrides.links ?? NAV_LINKS;
  return pack(n('nav'), 'content', [
    leaf('heading', { as: 'span', size: 'logo', text: logo, color: 'text-primary' }),
    pack(
      n('stack', {
        direction: 'row',
        gap: 'lg',
        align: 'center',
        justify: 'start',
        className: 'hidden md:flex',
      }),
      'content',
      links.map((link, index) =>
        leaf('nav-link', { label: link.label.toUpperCase(), href: link.href, active: index === 0 }),
      ),
    ),
    pack(
      n('stack', {
        direction: 'row',
        gap: 'md',
        align: 'center',
        justify: 'start',
        className: 'flex items-center space-x-4',
      }),
      'content',
      [
        leaf('icon', {
          icon: 'search',
          size: 20,
          href: '/products',
          className:
            'w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/5 transition-colors text-text-muted hover:text-primary',
        }),
        leaf('link', {
          label: 'Sign In',
          href: '/login',
          className:
            'font-label-sm text-[11px] font-bold tracking-[0.1em] text-text-muted hover:text-primary transition-colors',
        }),
        leaf('button', { label: 'Get Started', href: '/register', variant: 'nav-cta' }),
      ],
    ),
  ]);
}

// ------------------------------------------------------------------
// Hero
// ------------------------------------------------------------------

export interface HeroSeedInput {
  imageUrl?: string | null;
  fullHeight?: boolean;
  scrollIndicator?: boolean;
  backgroundOverlay?: number;
  contentAlign?: 'center' | 'left';
  backgroundColor?: string;
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  primaryCta?: { label: string; href: string } | null;
  secondaryCta?: { label: string; href: string } | null;
  showTrustChips?: boolean;
  trustNote?: string | null;
  trustNoteHref?: string | null;
  mesh?: boolean;
}

export function seedHero(overrides: HeroSeedInput = {}): SeedResult {
  const opts: HeroSeedInput = {
    imageUrl: heroDefaults.imageUrl,
    fullHeight: true,
    scrollIndicator: true,
    backgroundOverlay: 80,
    contentAlign: 'center',
    eyebrow: 'Precision Through Education',
    title: 'Engineering\nPrecision',
    subtitle:
      'From raw stock to finished parts — master CNC machining with project-based courses, interactive simulators, and mentorship from industry veterans.',
    primaryCta: { label: 'Start Learning', href: '/academy' },
    secondaryCta: { label: 'Explore Toolkits', href: '/products' },
    showTrustChips: true,
    trustNote: 'Free manufacturing education for all',
    mesh: true,
    ...overrides,
  };

  const children: SeedResult[] = [];
  if (opts.eyebrow) children.push(leaf('badge', { text: opts.eyebrow, variant: 'glow', size: 'md', marginBottom: 32 }));
  if (opts.title) children.push(leaf('heading', { as: 'h1', size: 'hero', text: opts.title, marginBottom: 24 }));
  if (opts.subtitle)
    children.push(
      leaf('text', {
        text: opts.subtitle,
        size: 'lg',
        color: 'text-text-secondary',
        opacity: 90,
        maxWidth: 672,
        marginBottom: 40,
      }),
    );
  const ctaChildren: SeedResult[] = [];
  if (opts.primaryCta) ctaChildren.push(leaf('button', { label: opts.primaryCta.label, href: opts.primaryCta.href, variant: 'primary' }));
  if (opts.secondaryCta) ctaChildren.push(leaf('button', { label: opts.secondaryCta.label, href: opts.secondaryCta.href, variant: 'glass' }));
  if (ctaChildren.length)
    children.push(
      pack(
        n('stack', { direction: 'column', gap: 'md', align: 'center', justify: 'center', className: 'cta-row' }),
        'content',
        ctaChildren,
      ),
    );

  return pack(n('hero', { paddingTop: 96, ...pick(opts as Record<string, unknown>, ['imageUrl', 'fullHeight', 'scrollIndicator', 'backgroundOverlay', 'contentAlign', 'backgroundColor', 'showTrustChips', 'trustNote', 'trustNoteHref', 'mesh']) }), 'content', children);
}

// ------------------------------------------------------------------
// Stats
// ------------------------------------------------------------------

export interface StatItemInput {
  icon?: string;
  value?: string;
  label?: string;
  tag?: string | null;
  tagVariant?: 'secondary' | 'primary' | 'neutral';
  tagIcon?: string | null;
  tagUppercase?: boolean;
}

export const STAT_ITEMS: StatItemInput[] = [
  { icon: 'groups', value: '17.4k+', label: 'Active Students', tag: '+22% This Quarter', tagVariant: 'secondary', tagIcon: 'trending_up', tagUppercase: false },
  { icon: 'verified', value: '98.2%', label: 'Certification Pass Rate', tag: 'Platinum Tier', tagVariant: 'primary' },
  { icon: 'public', value: '140+', label: 'Countries Represented', tag: '65 Countries', tagVariant: 'neutral' },
  { icon: 'monetization_on', value: '1,120%', label: 'Average Salary Uplift', tag: 'Top ROI', tagVariant: 'secondary' },
];

export function seedStatItem(overrides: StatItemInput = {}): SeedResult {
  const item: StatItemInput = { ...STAT_ITEMS[0], ...overrides };
  return packMulti(n('stat-item'), {
    content: [
      pack(
        n('stack', {
          direction: 'row',
          gap: 'md',
          align: 'start',
          justify: 'between',
          marginBottom: 24,
          className: 'flex justify-between items-start',
        }),
        'content',
        [
          leaf('icon', { icon: item.icon ?? 'groups', size: 24, box: 'tinted' }),
          item.tag
            ? leaf('badge', {
                text: item.tag,
                variant: item.tagVariant ?? 'secondary',
                size: 'sm',
                uppercase: item.tagUppercase ?? !item.tagIcon,
                icon: item.tagIcon ?? undefined,
              })
            : null,
        ].filter(Boolean) as SeedResult[],
      ),
      leaf('heading', { as: 'h3', size: 'stats', text: item.value ?? '', marginBottom: 4 }),
      leaf('text', {
        text: item.label ?? '',
        size: '2xs',
        uppercase: true,
        tracking: '0.2em',
        weight: 'bold',
        color: 'text-text-muted',
        marginTop: 4,
      }),
    ],
  });
}

export function seedStats(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (STAT_ITEMS as Record<string, unknown>[]);
  return pack(n('stats', { paddingBottom: 64 }), 'content', list.map((item) => seedStatItem(item as StatItemInput)));
}

// ------------------------------------------------------------------
// Partner logos
// ------------------------------------------------------------------

export interface LogoItemInput {
  imageUrl?: string | null;
  alt?: string;
  width?: number;
  height?: number;
  icon?: string;
  wordmark?: string;
}

export const PARTNER_LOGOS: LogoItemInput[] = [
  { imageUrl: 'https://logo.clearbit.com/microsoft.com', alt: 'Microsoft', width: 131, height: 32 },
  { imageUrl: 'https://logo.clearbit.com/intel.com', alt: 'Intel', width: 200, height: 40 },
  { icon: 'precision_manufacturing', wordmark: 'DESOAN' },
  { icon: 'settings_suggest', wordmark: 'INDUS-TECH' },
  { icon: 'robot_2', wordmark: 'ROBO-CORE' },
];

const LOGO_IMAGE_FADE =
  'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300';

export function seedLogoItem(overrides: LogoItemInput = {}): SeedResult {
  const item: LogoItemInput = { ...overrides };
  if (item.imageUrl) {
    const heightClass = item.height === 32 ? 'h-8 w-auto' : 'h-10 w-auto';
    return pack(n('logo-item'), 'content', [
      leaf('image', {
        src: item.imageUrl,
        alt: item.alt ?? '',
        width: item.width,
        height: item.height,
        objectFit: 'contain',
        className: `${heightClass} ${LOGO_IMAGE_FADE}`,
      }),
    ]);
  }
  return pack(n('logo-item'), 'content', [
    pack(
      n('stack', {
        direction: 'row',
        gap: 'sm',
        align: 'center',
        justify: 'center',
        className: `flex items-center gap-2 ${LOGO_IMAGE_FADE}`,
      }),
      'content',
      [
        leaf('icon', { icon: item.icon ?? 'precision_manufacturing', size: 28 }),
        leaf('heading', { as: 'span', size: 'xl', text: item.wordmark ?? '', className: 'font-bold tracking-tighter' }),
      ],
    ),
  ]);
}

export function seedPartnerLogos(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (PARTNER_LOGOS as Record<string, unknown>[]);
  return packMulti(n('partner-logos', { paddingTop: 96, paddingBottom: 96 }), {
    header: [
      leaf('text', {
        text: 'Trusted by Global Leaders',
        size: 'xs',
        uppercase: true,
        tracking: '0.2em',
        weight: 'bold',
        color: 'text-text-muted',
      }),
    ],
    logos: list.map((item) => seedLogoItem(item as LogoItemInput)),
  });
}

// ------------------------------------------------------------------
// Feature tiles
// ------------------------------------------------------------------

export interface FeatureItemInput {
  icon?: string;
  title?: string;
  description?: string;
}

export const FEATURES: FeatureItemInput[] = [
  {
    icon: 'biotech',
    title: 'Precision-Driven Curriculum',
    description:
      'Every lesson is engineered around real machining tolerances — from basic feeds and speeds to micro-level surface finish optimization.',
  },
  {
    icon: 'history_edu',
    title: 'Learn From Industry Veterans',
    description:
      'Your mentors have thousands of hours on five-axis machines and Swiss-type lathes. Their shortcuts become your skill.',
  },
  {
    icon: 'terminal',
    title: 'Interactive CAM Workflows',
    description:
      'Design toolpaths, simulate collisions, and validate G-code in our interactive CAM workspace before you ever touch metal.',
  },
];

export function seedFeatureItem(overrides: FeatureItemInput = {}): SeedResult {
  const item: FeatureItemInput = { ...FEATURES[0], ...overrides };
  return packMulti(n('feature-item'), {
    content: [
      leaf('icon', { icon: item.icon ?? 'biotech', size: 24, box: 'white' }),
      pack(
        n('stack', { direction: 'column', gap: 'none', align: 'stretch', justify: 'start' }),
        'content',
        [
          leaf('heading', { as: 'h4', size: 'xl', text: item.title ?? '', marginBottom: 8 }),
          leaf('text', {
            text: item.description ?? '',
            size: 'md',
            color: 'text-text-muted',
            opacity: 80,
            className: 'leading-relaxed',
          }),
        ],
      ),
    ],
  });
}

export function seedFeatureTiles(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (FEATURES as Record<string, unknown>[]);
  const children: SeedResult[] = [
    leaf('text', {
      text: 'The Machinist Advantage',
      size: 'sm',
      uppercase: true,
      tracking: '0.2em',
      weight: 'bold',
      color: 'text-primary',
      marginBottom: 16,
    }),
    leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Why Choose the Ahmad CNC Academy?', marginBottom: 32, className: 'leading-tight' }),
    ...list.map((item) => seedFeatureItem(item as FeatureItemInput)),
  ];
  return pack(n('feature-tiles', { paddingTop: 96, paddingBottom: 96, ...pick(overrides, ['imageUrl', 'imageAlt']) }), 'content', children);
}

// ------------------------------------------------------------------
// Academy grid
// ------------------------------------------------------------------

export interface AcademyCardInput {
  imageUrl?: string | null;
  title?: string;
  description?: string;
  level?: string;
  modules?: string;
  count?: string;
  href?: string;
}

export const ACADEMIES: AcademyCardInput[] = [
  {
    imageUrl: heroDefaults.imageUrl,
    title: 'CNC Machining Fundamentals',
    description: 'The complete roadmap from machine setup to G-code mastery — built for beginners and refreshers alike.',
    level: 'Beginner to Advanced',
    modules: '36 Modules',
    count: '+80',
    href: '/academy',
  },
  {
    imageUrl: ctaBannerDefaults.imageUrl,
    title: 'Advanced Multi-Axis Programming',
    description: 'Five-axis strategies, collision avoidance, and post-processor tuning for production-ready toolpaths.',
    level: 'Advanced',
    modules: '60 Modules',
    count: '+40',
    href: '/academy',
  },
  {
    imageUrl: heroDefaults.imageUrl,
    title: 'Precision Grinding & Finishing',
    description: 'Surface and cylindrical grinding techniques for sub-micron finishes on aerospace-grade components.',
    level: 'Intermediate',
    modules: '48 Modules',
    count: '+25',
    href: '/academy',
  },
];

export function seedAcademyCard(overrides: AcademyCardInput = {}): SeedResult {
  const item: AcademyCardInput = { ...ACADEMIES[0], ...overrides };
  return packMulti(n('academy-card', { href: item.href }), {
    media: [
      leaf('image', {
        src: item.imageUrl ?? '',
        alt: item.title ?? '',
        objectFit: 'cover',
        aspectRatio: '16/10',
        className: 'object-cover group-hover:scale-105 transition-transform duration-700',
      }),
    ],
    content: [
      pack(
        n('stack', {
          direction: 'row',
          gap: 'sm',
          align: 'center',
          justify: 'start',
          marginBottom: 16,
          className: 'flex items-center gap-2',
        }),
        'content',
        [
          leaf('badge', { text: item.level ?? '', variant: 'card', size: 'sm' }),
          leaf('text', { text: item.modules ?? '', size: 'xs', weight: 'medium', color: 'text-text-muted' }),
        ],
      ),
      leaf('heading', { as: 'h3', size: '2xl', text: item.title ?? '', marginBottom: 16, className: 'leading-tight' }),
      leaf('text', {
        text: item.description ?? '',
        size: 'md',
        color: 'text-text-muted',
        opacity: 80,
        marginBottom: 32,
        className: 'line-clamp-2',
      }),
      pack(
        n('stack', {
          direction: 'row',
          gap: 'md',
          align: 'center',
          justify: 'between',
          className: 'flex items-center justify-between pt-6 border-t border-glass-border',
        }),
        'content',
        [
          leaf('avatar-stack', { count: item.count ?? '+80' }),
          // The card itself is the anchor; the label is decorative (ButtonBlock
          // renders it as a `<span>` when href is empty, so no nested `<a>`).
          leaf('button', { label: 'Enroll Now', href: '', variant: 'enroll', icon: 'arrow_forward', iconPosition: 'right' }),
        ],
      ),
    ],
  });
}

export function seedAcademyGrid(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (ACADEMIES as Record<string, unknown>[]);
  return packMulti(
    n('academy-grid', { paddingTop: 64, paddingBottom: 64, ...pick(overrides, ['viewAllHref']) }),
    {
      header: [
        pack(
          n('stack', {
            direction: 'column',
            gap: 'none',
            align: 'start',
            justify: 'start',
            maxWidth: 576,
            className: 'max-w-xl',
          }),
          'content',
          [
            leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Popular Academies', marginBottom: 16 }),
            leaf('text', {
              text: 'Start with the fundamentals or push into five-axis territory — every path is designed to take you from blueprint to finished part.',
              size: 'md',
              color: 'text-text-secondary',
              opacity: 80,
            }),
          ],
        ),
        leaf('button', {
          label: 'View All Paths',
          href: (overrides.viewAllHref as string | undefined) ?? '/academy',
          variant: 'pill',
          icon: 'arrow_forward',
          iconPosition: 'right',
          className: 'mt-6 md:mt-0',
        }),
      ],
      cards: list.map((item) => seedAcademyCard(item as AcademyCardInput)),
    },
  );
}

// ------------------------------------------------------------------
// CTA banner
// ------------------------------------------------------------------

export interface ProgressCardInput {
  percent?: number;
  title?: string;
  subtitle?: string;
  label?: string;
  value?: string;
}

export function seedProgressCard(overrides: ProgressCardInput = {}): SeedResult {
  const item: ProgressCardInput = {
    percent: 85,
    title: 'Certification Status',
    subtitle: 'Industry Accredited',
    label: 'Core Mastery Progress',
    value: '85.4%',
    ...overrides,
  };
  return leaf('progress-card', { ...item });
}

export function seedCtaBanner(overrides: Record<string, unknown> = {}): SeedResult {
  const title = (overrides.title as string | undefined) ?? 'Scale Your Skills to the Micron Level';
  const subtitle =
    (overrides.subtitle as string | undefined) ??
    'Join thousands of machinists building precision careers. Your first academy is waiting.';
  const primaryCta = (overrides.primaryCta as { label: string; href: string } | undefined) ?? {
    label: 'Start Your Academy',
    href: '#',
  };
  const secondaryCta = (overrides.secondaryCta as { label: string; href: string } | undefined) ?? {
    label: 'Corporate Solutions',
    href: '#',
  };
  const copyChildren: SeedResult[] = [
    leaf('heading', { as: 'h2', size: 'headline-lg', text: title, color: 'text-white', marginBottom: 32 }),
    leaf('text', {
      text: subtitle,
      size: 'lg',
      color: 'text-white/80',
      maxWidth: 512,
      marginBottom: 48,
      align: 'center',
    }),
    pack(
      n('stack', { direction: 'column', gap: 'md', align: 'center', justify: 'center', className: 'cta-row' }),
      'content',
      [
        leaf('button', { label: primaryCta.label, href: primaryCta.href, variant: 'white' }),
        leaf('button', { label: secondaryCta.label, href: secondaryCta.href, variant: 'white-outline' }),
      ],
    ),
  ];
  return packMulti(n('cta-banner', { paddingTop: 96, paddingBottom: 96, ...pick(overrides, ['imageUrl']) }), {
    copy: copyChildren,
    side: [seedProgressCard()],
  });
}

// ------------------------------------------------------------------
// FAQ
// ------------------------------------------------------------------

export interface FaqItemInput {
  question?: string;
  answer?: string;
}

export const FAQ_ITEMS: FaqItemInput[] = [
  {
    question: 'How much does it cost to join the academy?',
    answer:
      'The Ahmad CNC academy is completely free. Every course, toolkit, and resource is available to anyone with an internet connection — no hidden fees, ever.',
  },
  {
    question: 'Do I need a CNC machine at home?',
    answer:
      'Not at all. Our interactive CAM simulator lets you program, simulate, and validate toolpaths entirely online. Most students start without any physical equipment.',
  },
  {
    question: 'What can I do with a certification?',
    answer:
      'Graduates earn an industry-recognized credential that signals readiness for entry-level machinist, operator, and CNC programmer roles.',
  },
  {
    question: 'Are the instructors experienced professionals?',
    answer:
      'Yes. Every mentor brings years of hands-on shop floor experience across aerospace, mold and die, and Swiss machining.',
  },
];

export function seedFaqItem(overrides: FaqItemInput = {}): SeedResult {
  const item: FaqItemInput = { ...FAQ_ITEMS[0], ...overrides };
  return packMulti(n('faq-item'), {
    toggle: [leaf('heading', { as: 'span', size: 'lg', text: item.question ?? '' })],
    content: [
      leaf('text', {
        text: item.answer ?? '',
        size: 'md',
        color: 'text-text-muted',
        opacity: 80,
        className: 'leading-relaxed',
      }),
    ],
  });
}

export function seedFaq(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (FAQ_ITEMS as Record<string, unknown>[]);
  return packMulti(n('faq', { paddingTop: 96, paddingBottom: 96 }), {
    header: [
      leaf('text', {
        text: 'Support Center',
        size: 'sm',
        uppercase: true,
        tracking: '0.2em',
        weight: 'bold',
        color: 'text-primary',
        marginBottom: 16,
      }),
      leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Frequently Asked Questions' }),
    ],
    items: list.map((item) => seedFaqItem(item as FaqItemInput)),
    footer: [
      leaf('text', {
        text: 'Still have questions?',
        size: 'md',
        align: 'center',
        color: 'text-text-muted',
        marginBottom: 24,
      }),
      leaf('button', { label: 'Contact Technical Support', href: '#', variant: 'link', icon: 'arrow_forward', iconPosition: 'right' }),
    ],
  });
}

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------

export interface FooterColInput {
  title?: string;
  links?: string[];
}

export const FOOTER_COLUMNS: FooterColInput[] = [
  { title: 'Academies', links: ['CNC Machining', 'Aerospace', 'Grinding', 'Swiss Machining'] },
  { title: 'Resources', links: ['Toolkits', 'G-Code Library', 'Simulator', 'Blog'] },
  { title: 'Institutional', links: ['Corporate Training', 'Partnerships', 'Careers', 'Contact'] },
];

export function seedFooterCol(overrides: FooterColInput = {}): SeedResult {
  const item: FooterColInput = { ...FOOTER_COLUMNS[0], ...overrides };
  const children: SeedResult[] = [
    leaf('heading', { as: 'h4', size: 'label', text: item.title ?? '', color: 'text-text-primary', marginBottom: 16 }),
  ];
  for (const label of item.links ?? []) {
    children.push(leaf('link', { label, href: '#' }));
  }
  return pack(n('footer-col'), 'content', children);
}

export function seedFooterBrand(): SeedResult {
  return packMulti(n('footer-col'), {
    content: [
      leaf('heading', { as: 'span', size: 'logo', text: 'Ahmad CNC', color: 'text-primary', marginBottom: 24 }),
      leaf('text', {
        text: 'Precision manufacturing education for the next generation of machinists.',
        size: 'md',
        color: 'text-text-muted',
        opacity: 80,
        maxWidth: 320,
        className: 'max-w-xs',
        marginBottom: 32,
      }),
      pack(
        n('stack', { direction: 'row', gap: 'md', align: 'center', justify: 'start', className: 'flex gap-4' }),
        'content',
        [
          leaf('link', { label: '', href: '#', icon: 'public' }),
          leaf('link', { label: '', href: '#', icon: 'terminal' }),
        ],
      ),
    ],
  });
}

export function seedFooter(overrides: Record<string, unknown> = {}): SeedResult {
  const cols = itemsOf(overrides) ?? (FOOTER_COLUMNS as Record<string, unknown>[]);
  return packMulti(n('footer', { paddingTop: 96, paddingBottom: 48 }), {
    columns: [seedFooterBrand(), ...cols.map((col) => seedFooterCol(col as FooterColInput))],
    bottom: [
      leaf('text', { text: '© 2026 Machinist Pro Educational Systems. All rights reserved.', size: 'sm', color: 'text-text-muted' }),
      pack(
        n('stack', { direction: 'row', gap: 'lg', align: 'center', justify: 'start', className: 'flex gap-8' }),
        'content',
        [
          leaf('text', { text: 'Designed for sub-micron precision.', size: 'sm', uppercase: true, tracking: '0.05em', weight: 'medium', color: 'text-text-muted' }),
          leaf('text', { text: 'Engineered in ISO-9001.', size: 'sm', uppercase: true, tracking: '0.05em', weight: 'medium', color: 'text-text-muted' }),
        ],
      ),
    ],
  });
}

// ------------------------------------------------------------------
// Full pages
// ------------------------------------------------------------------

/** The canonical home page: hero, stats, logos, features, academies, CTA, FAQ, footer. */
export function seedHomeLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedHero(),
    seedStats(),
    seedPartnerLogos(),
    seedFeatureTiles(),
    seedAcademyGrid(),
    seedCtaBanner(),
    seedFaq(),
    seedFooter(),
  ];
  return toLayout(sections);
}

/** The academy landing page: tailored hero + academy grid. */
export function seedAcademyLandingLayout(): PageLayout {
  const hero = seedHero({
    title: 'Choose Your Path',
    subtitle:
      'Four specialized academies. One mission: free manufacturing education for all.',
    eyebrow: 'Four specialized academies',
    primaryCta: { label: 'Browse Courses', href: '/courses' },
    secondaryCta: null,
    fullHeight: false,
    scrollIndicator: false,
  });
  const grid = seedAcademyGrid({
    viewAllHref: '/academy',
    items: [
      {
        title: 'CNC Machining Academy',
        description: 'Master CNC mills, lathes, and multi-axis machining with project-based courses.',
        level: 'Beginner',
        modules: '200+ Courses',
        count: '+50K',
        href: '/courses?academy=cnc',
      },
      {
        title: 'Aerospace Academy',
        description: 'Precision machining for aerospace standards. AS9100-aligned curriculum.',
        level: 'Advanced',
        modules: '80+ Courses',
        count: '+25K',
        href: '/courses?academy=aerospace',
      },
      {
        title: 'Grinding Academy',
        description: 'Surface, cylindrical, and tool grinding — from basics to advanced.',
        level: 'Intermediate',
        modules: '60+ Courses',
        count: '+15K',
        href: '/courses?academy=grinding',
      },
    ],
  });
  return toLayout([hero, grid]);
}

// ------------------------------------------------------------------
// Static public pages (about + legal) — built from the same blocks so
// every element is editable in the builder.
// ------------------------------------------------------------------

interface LegalSectionInput {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/** Legal-style pages: title + "last updated" line, then heading/paragraph/bullet blocks. */
export function seedLegalLayout(title: string, updatedAt: string, sections: LegalSectionInput[]): PageLayout {
  const children: SeedResult[] = [
    leaf('heading', { as: 'h1', size: 'headline-lg', text: title }),
    leaf('text', { text: updatedAt, size: 'sm', color: 'text-text-muted', marginBottom: 40 }),
  ];
  for (const section of sections) {
    children.push(leaf('heading', { as: 'h2', size: '2xl', text: section.heading, marginTop: 48, marginBottom: 16 }));
    for (const paragraph of section.paragraphs ?? []) {
      children.push(leaf('text', { text: paragraph, size: 'md', color: 'text-text-muted', marginBottom: 16, className: 'leading-relaxed' }));
    }
    for (const bullet of section.bullets ?? []) {
      children.push(leaf('text', { text: `• ${bullet}`, size: 'md', color: 'text-text-muted', marginBottom: 8, className: 'leading-relaxed' }));
    }
  }
  const body = pack(
    n('section', { className: 'container mx-auto px-4', maxWidth: 768, paddingTop: 64, paddingBottom: 96 }),
    'content',
    children,
  );
  return toLayout([body]);
}

export function seedPrivacyLayout(): PageLayout {
  return seedLegalLayout('Privacy Policy', 'Last updated: July 2026', [
    {
      heading: 'Information We Collect',
      paragraphs: [
        'We collect information you provide directly, such as your name, email address, and profile information when you create an account or contact us.',
        'We automatically collect certain information when you visit our platform, including your IP address, browser type, device information, and usage data through cookies and similar technologies.',
      ],
    },
    {
      heading: 'How We Use Your Information',
      paragraphs: ['We use the information we collect to:'],
      bullets: [
        'Provide, maintain, and improve our educational platform',
        'Process enrollments, certifications, and purchases',
        'Send technical notices, updates, and support messages',
        'Respond to your comments, questions, and requests',
        'Monitor and analyze trends, usage, and activities',
      ],
    },
    {
      heading: 'Data Sharing',
      paragraphs: [
        'We do not sell your personal information. We may share data with trusted service providers who help us operate our platform, subject to confidentiality agreements.',
      ],
    },
    {
      heading: 'Data Retention',
      paragraphs: [
        'We retain your personal information for as long as your account is active or as needed to provide you services, comply with legal obligations, resolve disputes, and enforce agreements.',
      ],
    },
    {
      heading: 'Your Rights',
      paragraphs: [
        'You may access, update, or delete your account information at any time through your account settings. You may opt out of marketing communications at any time.',
      ],
    },
    {
      heading: 'Security',
      paragraphs: [
        'We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['For questions about this privacy policy, contact us at privacy@titansofcnc.com.'],
    },
  ]);
}

export function seedRefundsLayout(): PageLayout {
  return seedLegalLayout('Refund Policy', 'Last updated: July 2026', [
    {
      heading: 'Digital Products (Courses & Certifications)',
      paragraphs: [
        'Due to the digital nature of our educational content, all purchases of online courses, certifications, and digital downloads are final and non-refundable once accessed.',
        'If you experience technical issues preventing access, contact us within 14 days for resolution.',
      ],
    },
    {
      heading: 'Physical Products',
      paragraphs: [
        'Physical products may be returned within 30 days of delivery in original condition. Shipping costs are non-refundable. Contact us for a return authorization.',
      ],
    },
    {
      heading: 'Shipping',
      paragraphs: [
        'Refunds for shipping charges are only provided if the error was on our part. Damaged items must be reported within 7 days of delivery.',
      ],
    },
    {
      heading: 'Refund Process',
      paragraphs: ['Approved refunds are processed within 5-10 business days to the original payment method.'],
    },
    {
      heading: 'Exceptions',
      paragraphs: [
        'Bulk/enterprise purchases, sponsored content, and event registrations may have separate cancellation policies as stated at time of purchase.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['Contact us at orders@titansofcnc.com.'],
    },
  ]);
}

export function seedTermsLayout(): PageLayout {
  return seedLegalLayout('Terms of Service', 'Last updated: July 2026', [
    {
      heading: 'Acceptance',
      paragraphs: [
        'By accessing or using the TITANS of Manufacturing platform, you agree to be bound by these terms. If you do not agree, do not use the service.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate, current information.',
      ],
    },
    {
      heading: 'Content',
      paragraphs: [
        'All course materials, videos, and educational content are protected by copyright. You may access content for personal, non-commercial educational use. Redistribution is prohibited.',
      ],
    },
    {
      heading: 'User Conduct',
      paragraphs: [
        'You agree not to: violate laws, infringe intellectual property, distribute malware, harass others, or interfere with platform operations.',
      ],
    },
    {
      heading: 'Payments & Refunds',
      paragraphs: [
        'Paid products and services are subject to our refund policy. We reserve the right to change pricing with notice.',
      ],
    },
    {
      heading: 'Limitation of Liability',
      paragraphs: [
        'TITANS of Manufacturing is not liable for indirect, incidental, or consequential damages arising from your use of the platform.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'We may suspend or terminate accounts for violations of these terms. You may delete your account at any time.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: ['Contact us at legal@titansofcnc.com.'],
    },
  ]);
}

export function seedEduPurchasesLayout(): PageLayout {
  return seedLegalLayout('Educational & Institutional Purchases', 'Last updated: July 2026', [
    {
      heading: 'Academic Pricing',
      paragraphs: [
        'We offer discounted pricing for accredited educational institutions, including schools, colleges, universities, and training centers. Academic pricing applies to bulk course licenses, lab subscriptions, and institutional memberships.',
      ],
    },
    {
      heading: 'How to Qualify',
      bullets: [
        'Use your institution-issued email address (.edu or equivalent)',
        'Provide proof of accreditation or institutional affiliation',
        'Minimum purchase quantities may apply',
      ],
    },
    {
      heading: 'Institutional Licensing',
      paragraphs: [
        'Our institutional license allows unlimited student access within your organization, administrative dashboards for tracking progress, custom curriculum paths, and dedicated support.',
      ],
    },
    {
      heading: 'Purchase Order (PO) Terms',
      paragraphs: [
        'We accept purchase orders from accredited institutions. Net 30 terms are available for qualifying organizations. Contact our team to set up PO-based purchasing.',
      ],
    },
    {
      heading: 'Contact Our Education Team',
      paragraphs: ['Contact us at education@titansofcnc.com.'],
    },
  ]);
}

/** The about page: story band, intro, DNA cards, stats, journey timeline, team, trust badges. */
export function seedAboutLayout(): PageLayout {
  const section = (className: string, paddingTop: number, paddingBottom: number, children: SeedResult[]): SeedResult =>
    pack(n('section', { className, paddingTop, paddingBottom }), 'content', children);
  const container = (children: SeedResult[], extra = 'container mx-auto px-4'): SeedResult =>
    pack(n('stack', { direction: 'column', gap: 'none', align: 'stretch', justify: 'start', className: extra }), 'content', children);

  const hero = section('border-b bg-gradient-to-br from-background via-secondary/10 to-primary/5', 96, 96, [
    container(
      [
        leaf('heading', { as: 'h1', size: 'headline-lg', text: 'Our Story', align: 'center', marginBottom: 16 }),
        leaf('text', {
          text: 'From a single CNC shop to a global education movement — TITANS of Manufacturing is on a mission to save manufacturing education and inspire the next generation of makers.',
          size: 'lg',
          color: 'text-text-muted',
          align: 'center',
          maxWidth: 672,
          className: 'mx-auto',
        }),
      ],
      'container mx-auto px-4 text-center',
    ),
  ]);

  const intro = section('bg-secondary/10', 64, 64, [
    container([
      leaf('text', {
        text: "Founded in 2012 by Titan Gilroy, TITANS of CNC began as a precision machine shop in California and grew into the world's largest manufacturing education platform. Our 100% free, project-based courses have empowered hundreds of thousands of students worldwide to start or advance their careers in CNC machining, aerospace manufacturing, grinding, and Swiss machining.",
        size: 'md',
        color: 'text-text-muted',
        align: 'center',
        maxWidth: 768,
        className: 'mx-auto leading-relaxed',
      }),
    ]),
  ]);

  const dnaCards = [
    { icon: 'school', title: '100% Free Education', desc: 'Our core mission is to make world-class manufacturing education accessible to everyone, regardless of location or budget.' },
    { icon: 'groups', title: 'Committed to Community', desc: 'We build more than courses — we build a global community of machinists, engineers, and manufacturers helping each other grow.' },
    { icon: 'star', title: 'World-Class Content', desc: 'Every course is produced with cinematic quality, real-world projects, and input from industry experts across every discipline.' },
  ].map(
    (item) =>
      pack(
        n('card', { padding: 'lg', bg: 'muted', radius: 'xl', border: true, align: 'center', hover: true }),
        'content',
        [
          leaf('icon', {
            icon: item.icon,
            size: 24,
            color: 'text-primary',
            className: 'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10',
          }),
          leaf('heading', { as: 'h3', size: 'xl', text: item.title, marginBottom: 8 }),
          leaf('text', { text: item.desc, size: 'sm', color: 'text-text-muted' }),
        ],
      ),
  );

  const dna = section('', 80, 80, [
    container([
      leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Our DNA', align: 'center', marginBottom: 48 }),
      pack(n('grid', { columns: 3, gap: 'lg' }), 'items', dnaCards),
    ]),
  ]);

  const stats = [
    { icon: 'bolt', value: '4.5M+', label: 'YouTube Followers' },
    { icon: 'public', value: '2.2B+', label: 'Total Views' },
    { icon: 'school', value: '500K+', label: 'Students Educated' },
    { icon: 'verified', value: '100K+', label: 'Course Certifications' },
  ].map(
    (item) =>
      pack(
        n('stack', { direction: 'column', gap: 'none', align: 'center', justify: 'center' }),
        'content',
        [
          leaf('icon', {
            icon: item.icon,
            size: 20,
            color: 'text-primary',
            className: 'mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10',
          }),
          leaf('heading', { as: 'span', size: 'stats', text: item.value, align: 'center' }),
          leaf('text', { text: item.label, size: 'sm', color: 'text-text-muted', align: 'center' }),
        ],
      ),
  );

  const statsBand = section('bg-secondary/10', 64, 64, [
    container([pack(n('grid', { columns: 4, gap: 'lg' }), 'items', stats)]),
  ]);

  const timeline = [
    { year: '2012', title: 'Defying The Odds', desc: 'TITANS of CNC is founded with a mission to save manufacturing education.' },
    { year: '2014', title: 'No Ordinary Job Shop', desc: 'The TITANS shop establishes itself as a cutting-edge precision CNC facility.' },
    { year: '2017', title: 'Education Revolution', desc: 'Launch of free online CNC courses — the first of their kind.' },
    { year: '2020', title: 'Driving Awareness', desc: 'Global campaign to bring manufacturing careers to the forefront.' },
    { year: '2022', title: 'Global Expansion', desc: 'Academies launch for Aerospace, Grinding, and Swiss Machining.' },
    { year: '2024', title: 'Rise to Greatness', desc: 'Over 4.5M followers, partnerships with 200+ industry leaders.' },
  ].map(
    (item) =>
      pack(
        n('stack', { direction: 'column', gap: 'none', align: 'stretch', justify: 'start' }),
        'content',
        [
          leaf('heading', { as: 'span', size: 'lg', text: item.year, color: 'text-primary' }),
          leaf('heading', { as: 'h3', size: 'xl', text: item.title, marginTop: 4 }),
          leaf('text', { text: item.desc, size: 'sm', color: 'text-text-muted', marginTop: 4 }),
        ],
      ),
  );

  const journey = section('', 80, 80, [
    container([
      leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Our Journey', align: 'center', marginBottom: 48 }),
      pack(
        n('stack', {
          direction: 'column',
          gap: 'none',
          align: 'stretch',
          justify: 'start',
          className: 'relative pl-8 border-l-2 border-primary/30',
        }),
        'content',
        timeline,
      ),
    ], 'container mx-auto px-4 max-w-3xl'),
  ]);

  const team = [
    { name: 'Titan Gilroy', role: 'Founder & CEO', initials: 'TG' },
    { name: 'Sarah Mitchell', role: 'VP of Education', initials: 'SM' },
    { name: 'James Chen', role: 'Head of Content', initials: 'JC' },
    { name: 'Maria Rodriguez', role: 'Community Director', initials: 'MR' },
    { name: 'David Kim', role: 'Lead Instructor', initials: 'DK' },
    { name: 'Emily Foster', role: 'Curriculum Designer', initials: 'EF' },
    { name: 'Alex Thompson', role: 'Technical Director', initials: 'AT' },
    { name: 'Lisa Wang', role: 'Partnerships Lead', initials: 'LW' },
  ].map(
    (member) =>
      pack(
        n('card', { padding: 'md', bg: 'muted', radius: 'xl', border: true, align: 'center', hover: true }),
        'content',
        [
          leaf('heading', {
            as: 'span',
            size: 'xl',
            text: member.initials,
            color: 'text-primary',
            className: 'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold',
          }),
          leaf('heading', { as: 'h3', size: 'xl', text: member.name }),
          leaf('text', { text: member.role, size: 'sm', color: 'text-text-muted' }),
        ],
      ),
  );

  const teamBand = section('bg-secondary/10', 80, 80, [
    container([
      leaf('heading', { as: 'h2', size: 'headline-lg', text: 'Our Team', align: 'center', marginBottom: 48 }),
      pack(n('grid', { columns: 4, gap: 'md' }), 'items', team),
    ]),
  ]);

  const trustBadges = [
    { icon: 'factory', title: 'Based in the US', desc: 'Proudly headquartered in Texas.' },
    { icon: 'school', title: 'Free Education', desc: '100% free academy courses, forever.' },
    { icon: 'wrench', title: 'Online Support', desc: 'Expert support within 24 hours.' },
    { icon: 'public', title: 'Global Community', desc: '4.5M+ members worldwide.' },
  ].map(
    (item) =>
      pack(
        n('stack', { direction: 'column', gap: 'none', align: 'center', justify: 'center' }),
        'content',
        [
          leaf('icon', {
            icon: item.icon,
            size: 24,
            color: 'text-primary',
            className: 'mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10',
          }),
          leaf('heading', { as: 'h3', size: 'sm', text: item.title, align: 'center' }),
          leaf('text', { text: item.desc, size: 'sm', color: 'text-text-muted', align: 'center', marginTop: 4 }),
        ],
      ),
  );

  const badges = section('border-t bg-secondary/10', 64, 64, [
    container([pack(n('grid', { columns: 4, gap: 'lg' }), 'items', trustBadges)]),
  ]);

  return toLayout([hero, intro, dna, statsBand, journey, teamBand, badges]);
}

function toLayout(sections: SeedResult[]): PageLayout {
  return { root: { props: {} }, content: sections.map((section) => section.node) };
}

// ------------------------------------------------------------------
// Insert seeds — wired onto the registry so the editor can seed a fresh
// subtree whenever a container block is inserted.
// ------------------------------------------------------------------

const SEEDABLE: Record<string, SeedFn> = {
  nav: seedNav as SeedFn,
  hero: seedHero as SeedFn,
  stats: seedStats,
  'stat-item': seedStatItem as SeedFn,
  'partner-logos': seedPartnerLogos,
  'logo-item': seedLogoItem as SeedFn,
  'feature-tiles': seedFeatureTiles,
  'feature-item': seedFeatureItem as SeedFn,
  'academy-grid': seedAcademyGrid,
  'academy-card': seedAcademyCard as SeedFn,
  'cta-banner': seedCtaBanner,
  'progress-card': seedProgressCard as SeedFn,
  faq: seedFaq,
  'faq-item': seedFaqItem as SeedFn,
  footer: seedFooter,
  'footer-col': seedFooterCol as SeedFn,
};

for (const [type, seed] of Object.entries(SEEDABLE)) {
  const def = BLOCK_REGISTRY[type];
  if (def) def.seed = seed;
}

export { SEEDABLE };
