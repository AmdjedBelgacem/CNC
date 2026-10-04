import type { PageLayout, PuckNode } from '../types/page';
import type { SeedFn, SeedResult } from './registry';
import {
  BLOCK_REGISTRY,
  cardGridDefaults,
  catalogHeroDefaults,
  closingCtaDefaults,
  liveIslandDefaults,
  spotlightCardsDefaults,
} from './registry';
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

/** A bare node with a fresh id. An explicitly passed `id` wins so sections can carry stable DOM anchors. */
export function n(type: string, props: Record<string, unknown> = {}): PuckNode {
  return { type, props: { id: newId(), ...props } };
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
  { label: 'Products', href: '/products' },
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
    secondaryCta: { label: 'Explore Products', href: '/products' },
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

// Capability statements, not fabricated metrics — the demo must not ship fake stats.
export const STAT_ITEMS: StatItemInput[] = [
  { icon: 'groups', value: 'Cohort-led', label: 'Learning Community', tag: 'Active', tagVariant: 'secondary', tagIcon: 'trending_up', tagUppercase: false },
  { icon: 'verified', value: 'Project-based', label: 'Certification Path', tag: 'Hands-on', tagVariant: 'primary' },
  { icon: 'public', value: 'Remote-first', label: 'Global Classroom', tag: 'Online', tagVariant: 'neutral' },
  { icon: 'monetization_on', value: 'Free to start', label: 'Core Curriculum', tag: 'Open', tagVariant: 'secondary' },
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
  // Heading copy is overridable so the homepage can set its own hierarchy and an
  // admin can reword it in the builder. The previous default named a brand we no
  // longer use.
  const eyebrow = (overrides.eyebrow as string | undefined) ?? 'The TITANS advantage';
  const heading =
    (overrides.title as string | undefined) ?? 'Built for the way machinists actually learn';
  const subtitle = overrides.subtitle as string | undefined;
  const children: SeedResult[] = [
    leaf('text', {
      text: eyebrow,
      size: 'sm',
      uppercase: true,
      tracking: '0.2em',
      weight: 'bold',
      color: 'text-primary',
      marginBottom: 16,
    }),
    leaf('heading', { as: 'h2', size: 'headline-lg', text: heading, marginBottom: 32, className: 'leading-tight' }),
    ...(subtitle
      ? [
          leaf('text', {
            text: subtitle,
            size: 'md',
            color: 'text-text-secondary',
            opacity: 80,
            marginBottom: 48,
            maxWidth: 640,
          }),
        ]
      : []),
    ...list.map((item) => seedFeatureItem(item as FeatureItemInput)),
  ];
  return pack(n('feature-tiles', { paddingTop: 96, paddingBottom: 96, ...pick(overrides, ['imageUrl', 'imageAlt', 'sectionBg']) }), 'content', children);
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
    n('academy-grid', { paddingTop: 64, paddingBottom: 64, ...pick(overrides, ['viewAllHref', 'id']) }),
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
            leaf('heading', {
              as: 'h2',
              size: 'headline-lg',
              text: (overrides.title as string | undefined) ?? 'Start with an academy',
              marginBottom: 16,
            }),
            leaf('text', {
              text:
                (overrides.subtitle as string | undefined) ??
                'Structured paths through the skills shops hire for.',
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
  /** Toggle icon (mockup uses a chevron; older seeds used a plus). */
  icon?: string;
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
  return packMulti(n('faq-item', item.icon ? { icon: item.icon } : {}), {
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
  return packMulti(n('faq', { paddingTop: 96, paddingBottom: 96, ...pick(overrides, ['sectionBg', 'id']) }), {
    header: [
      leaf('text', {
        text: (overrides.eyebrow as string | undefined) ?? 'Before you start',
        size: 'sm',
        uppercase: true,
        tracking: '0.2em',
        weight: 'bold',
        color: 'text-primary',
        marginBottom: 16,
      }),
      leaf('heading', {
        as: 'h2',
        size: 'headline-lg',
        text: (overrides.title as string | undefined) ?? 'Questions machinists ask us',
      }),
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
  { title: 'Resources', links: ['Products', 'G-Code Library', 'Simulator', 'Blog'] },
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
// Machinist Pro landing sections (hero console, stats deck, OEM strip,
// program cards, digital twin, testimonials, email CTA)
// ------------------------------------------------------------------

/** Mockup media assets shipped with the source design (placeholders — replace per tenant). */
export const LANDING_MEDIA = {
  heroConsole:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD_nykh4BbKBYgS_m9UfwRDQWz_ssTEc19wZjBgXZ4CUZOSrcOkRt1xktDZUxO8ToB8FuTIMiuIanVkmKvA1ebdVotwNzMGadZaxDNpvqlGtvtpdAOPVPBrZ21TCOsHFeZf90OIDzgj0aPQDH5D0tLwDn3R9FquQxESYhEPKlfeJQOL2oJboQTdpUaLRa7yMdQhzipChI7qq_Zhq339a8wiUaUPP6AcljyiLkSjdG0a0ODkFAMwVyQ',
  program5Axis:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDn9nZ-jv3NAQ1gTr5IY48SmybKwqkrXn-ekhri5-o20F1G40BQv9UMF_XwWzgrn600oiiZMfGCq26ZzSRQUfjr0Y59YiARQISrCg-E3jSHCSprDnMT6ZEhAYB9Y9sWIgX9CI-KXdiIrmHKvu_K1Q2zoe_Y0-_y7p_1oXzl2okKhUgC6ndV2b454NNYD-ugvNXQJS8zOpEYY3H1gzlu7Jamm8fX5zKcZ3_iJK_QdbNTht34WFAd82M',
  programSwiss:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDaffN3Zoc8aYOXXzKXtGlU_MzYaonAs7hYk6W0R_vMcCTupVW8_-cdh1XyU04smjTkFjoDA7MoDeH_1uBnic25gaFF3A-8XnQnlcuxAQXSvruyosqeQPyuLjkJDhSgcmVQ7dD9CD5CmnkWkWZuFcbNo0Inu5679IeVUF9ttgoBOHcfaUP4vRqyvoj7fOs77FIjeB-08MUvB6wOn-ihAc5ze17x9u4s_P9JSATWX6QycetaOSMLGhU',
  programHybrid:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBcXrf8hHSm70x-_Na7ozDO0g99jqT_CR7QnJbOdmHdr3o1RFho-Hj928q7pkttvK1ASvycW7JF8FfUZQQOTeCm8dKHUQ6b7r9eoqdOHIUdgwSoen5JCOZYUHeWsXOquOurCq6eYgLl7E-yJmzyaasARp3Op3Pbd6KjLz9Pb6BCxbkmVeDW4xHqTkTJ86AYf3O-V0q2k2yRkQIXJ_-BWp-GRWwV-CeZwBkekuaNtGBwx2Qk6RMq7ZM',
  reviewerGareth:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC7IwfDe1EJXuxLA1GPM3Ca77s_xzpx5NzSw_rtPKRP2l3DBLMKCEee_YM80sz8wLVr_YOtt_aefc0B9beQ-tBTXWmJ5C84g2CgO2QRU54mMxWPj4TZPeoQWPqlSCSxNzp9Qmc7GKAHisQ93ErqWfcBNsTyWUnRiI4VdT4DNTMnq0OYvOEnRas_WmaUJN3mMTUKhWYAdMqIXP2QvackQxf7jR_lVBrdA5Lmzu3mYNDScFvedrBkgKQ',
  reviewerSarah:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBPeY_qJg4UY0wYEKU4r1uqot5EBvYJeD4jbDS4ULOLQVcb9XMxPsT-ufCava-o_oEgZyaGIYEzv7Lhn9XCmTFc2OsUUvAy2GQKR0h9vml4IJEc-1hk0OTQwt3G7AZ-znz_wo6dl9oKiiY12z3411GGORJJBeRn5S508CNZeZmziYs9MNjKhCkhVSP82aE3JhApdO8AhFqW7RngwjPB1j2fwo3oLJpnO5hiwEZlJpbqoNq9j4iBVYE',
} as const;

export interface HeroConsoleSeedInput {
  eyebrow?: string;
  title?: string;
  titleAccent?: string;
  titleSuffix?: string;
  subtitle?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustCount?: string;
  trustNote?: string;
  imageUrl?: string;
  /** Console chrome filename shown in the hero's window bar. */
  fileName?: string;
}

// ------------------------------------------------------------------
/** Asymmetric hero: left editorial column (slot) + simulator console card (props). */
export function seedHeroConsole(overrides: HeroConsoleSeedInput = {}): SeedResult {
  const opts = {
    eyebrow: 'Next-Gen CNC & Precision Manufacturing',
    title: 'Architecting the',
    titleAccent: 'Future',
    titleSuffix: 'of Multi-Axis Machining.',
    subtitle:
      'Bridge the canyon between high-speed 5-axis digital CAM toolpaths and flawless shop floor execution. Master sub-micron tolerances, kinematic simulation, and simultaneous contouring with accredited industrial aerospace curricula.',
    primaryCta: { label: 'Start Training Cohort', href: '/register' },
    secondaryCta: { label: 'Explore 3D Console', href: '#digital-twin' },
    trustCount: '+17k',
    trustNote:
      '17,400+ aerospace & defense machinists actively enrolled across Boeing, SpaceX, and Lockheed supplier networks.',
    imageUrl: LANDING_MEDIA.heroConsole,
    fileName: 'SIM_CELL_DMG_DUOBODY_5X.cnc',
    ...overrides,
  };
  return packMulti(
    n('hero-console', {
      paddingTop: 80,
      paddingBottom: 112,
      imageUrl: opts.imageUrl,
      fileName: opts.fileName,
    }),
    {
      content: [
        leaf('badge', {
          text: opts.eyebrow,
          variant: 'glow',
          size: 'md',
          pulse: true,
          className: 'border border-primary/20 shadow-sm',
          marginBottom: 24,
        }),
        leaf('heading', {
          as: 'h1',
          size: 'hero',
          text: opts.title,
          accentText: opts.titleAccent,
          suffixText: opts.titleSuffix,
          marginBottom: 24,
        }),
        leaf('text', {
          text: opts.subtitle,
          size: 'lg',
          color: 'text-text-secondary',
          maxWidth: 576,
          marginBottom: 40,
        }),
        pack(
          n('stack', {
            direction: 'row',
            directionMobile: 'column',
            gap: 'md',
            align: 'center',
            justify: 'start',
            wrap: true,
            className: 'w-full sm:w-auto',
            marginBottom: 40,
          }),
          'content',
          [
            leaf('button', {
              label: opts.primaryCta.label,
              href: opts.primaryCta.href,
              variant: 'primary',
              icon: 'arrow_forward',
            }),
            leaf('button', {
              label: opts.secondaryCta.label,
              href: opts.secondaryCta.href,
              variant: 'glass',
              icon: 'view_in_ar',
              iconPosition: 'left',
            }),
          ],
        ),
        pack(
          n('stack', {
            direction: 'row',
            directionMobile: 'column',
            gap: 'md',
            align: 'center',
            justify: 'start',
            className:
              'flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-glass-border w-full',
          }),
          'content',
          [
            leaf('avatar-stack', { count: opts.trustCount, size: 40, plainCircles: 4 }),
            leaf('text', {
              text: opts.trustNote,
              size: 'sm',
              color: 'text-text-secondary',
              maxWidth: 448,
            }),
          ],
        ),
      ],
    },
  );
}


// ------------------------------------------------------------------
// Stats deck (Machinist Pro quick-stats cards)
// ------------------------------------------------------------------

export interface StatCardInput {
  label?: string;
  tag?: string;
  tagIcon?: string;
  tagVariant?: 'secondary' | 'primary' | 'neutral';
  value?: string;
  sub?: string;
  note?: string;
}

export const LANDING_STATS: StatCardInput[] = [
  {
    label: 'Global Talent',
    tag: '+24% YoY',
    tagIcon: 'north_east',
    value: '17.4k+',
    sub: 'Active Certified Machinists',
    note: 'Standardized across 5-axis ISO and AS9100 shops.',
  },
  {
    label: 'Quality Compliance',
    tag: 'Aerospace Spec',
    tagIcon: 'verified',
    value: '98.2%',
    sub: 'AS9100 / ISO Pass Rate',
    note: 'Zero tolerance critical defect threshold on flight parts.',
  },
  {
    label: 'Hardware Footprint',
    tag: '48 Countries',
    tagIcon: 'language',
    tagVariant: 'primary',
    value: '140+',
    sub: 'Industrial CNC Cells',
    note: 'DMG MORI, Hermle, and Mazak physical test hubs.',
  },
  {
    label: 'Earning Metric',
    tag: '+45% Avg Salary',
    tagIcon: 'trending_up',
    value: '1,120%',
    sub: 'Average Career ROI',
    note: 'Within 90 days of completing Master 5-Axis track.',
  },
];

export function seedStatCard(overrides: StatCardInput = {}): SeedResult {
  const item: StatCardInput = { ...LANDING_STATS[0], ...overrides };
  return packMulti(
    n('stat-item', {
      padding: 'md',
      radius: '2xl',
      accent: false,
      hover: true,
      className: 'hover:-translate-y-1 hover:shadow-xl',
    }),
    {
      content: [
        pack(
          n('stack', {
            direction: 'row',
            gap: 'sm',
            align: 'center',
            justify: 'between',
            marginBottom: 16,
            className: 'flex items-center justify-between',
          }),
          'content',
          [
            leaf('text', {
              text: item.label ?? '',
              size: 'xs',
              uppercase: true,
              tracking: '0.05em',
              weight: 'semibold',
              color: 'text-text-muted',
            }),
            leaf('badge', {
              text: item.tag ?? '',
              variant: item.tagVariant ?? 'secondary',
              size: 'sm',
              icon: item.tagIcon ?? undefined,
            }),
          ],
        ),
        leaf('heading', { as: 'h3', size: 'stats', text: item.value ?? '', marginBottom: 4 }),
        leaf('text', { text: item.sub ?? '', size: 'sm', weight: 'medium', color: 'text-text-secondary' }),
        leaf('text', {
          text: item.note ?? '',
          size: 'xs',
          color: 'text-text-muted',
          className: 'mt-4 pt-4 border-t border-glass-border',
        }),
      ],
    },
  );
}

export function seedStatsDeck(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (LANDING_STATS as Record<string, unknown>[]);
  return pack(
    n('stats', { id: 'benchmarks', overlap: 0, paddingTop: 48, paddingBottom: 48, gap: 'gap-6' }),
    'content',
    list.map((item) => seedStatCard(item as StatCardInput)),
  );
}


// ------------------------------------------------------------------
// OEM partner strip (bare wordmark grid)
// ------------------------------------------------------------------

export const LANDING_PARTNERS: { wordmark: string; className: string }[] = [
  { wordmark: 'DMG MORI', className: 'font-mono font-extrabold tracking-tighter' },
  { wordmark: 'HAAS', className: 'font-mono font-black tracking-tight' },
  { wordmark: 'MAZAK', className: 'font-bold tracking-widest' },
  { wordmark: 'SIEMENS NX', className: 'font-mono font-bold tracking-tight' },
  { wordmark: 'HERMLE', className: 'font-mono font-semibold tracking-tight' },
  { wordmark: 'Autodesk Fusion', className: 'font-medium tracking-normal' },
];

export function seedPartnerStrip(overrides: Record<string, unknown> = {}): SeedResult {
  return packMulti(
    n('partner-logos', {
      id: 'oem-partners',
      frame: 'strip',
      paddingTop: 64,
      paddingBottom: 64,
      headerMarginBottom: 32,
      className: 'border-y border-glass-border bg-surface-container-lowest/50',
    }),
    {
      header: [
        leaf('text', {
          text:
            (overrides.eyebrow as string | undefined) ??
            'Certified OEM & Software Integration Partners',
          size: 'xs',
          uppercase: true,
          tracking: '0.2em',
          weight: 'bold',
          color: 'text-text-muted',
        }),
      ],
      logos: LANDING_PARTNERS.map((p) =>
        pack(n('logo-item', { className: 'hover:scale-100' }), 'content', [
          leaf('text', {
            text: p.wordmark,
            size: 'lg',
            weight: 'bold',
            color: 'text-text-primary',
            className: `${p.className} opacity-70 hover:opacity-100 transition-opacity`,
          }),
        ]),
      ),
    },
  );
}

// ------------------------------------------------------------------
// Program cards (learning paths grid)
// ------------------------------------------------------------------

export interface ProgramCardInput {
  imageUrl?: string;
  level?: string;
  levelTone?: 'primary' | 'secondary' | 'accent';
  duration?: string;
  metaIcon?: string;
  metaLabel?: string;
  title?: string;
  description?: string;
  tags?: string;
  instructorInitials?: string;
  instructorName?: string;
  href?: string;
  ctaLabel?: string;
}

export const LANDING_PROGRAMS: ProgramCardInput[] = [
  {
    imageUrl: LANDING_MEDIA.program5Axis,
    level: 'EXPERT TIER',
    levelTone: 'primary',
    duration: '24 Modules · 120 Hrs',
    metaIcon: 'radar',
    metaLabel: 'Live Kinematic Collision Sim',
    title: '5-Axis Simultaneous Milling Masterclass',
    description:
      'Deep-dive into RTCP (Rotational Tool Center Point), swarf milling, vector tilt optimization, and anti-gouging strategies for titanium turbomachinery.',
    tags: 'Heidenhain TNC, Siemens 840D, Mastercam 2024',
    instructorInitials: 'MK',
    instructorName: 'Dr. Marcus Vance',
    href: '/academy',
  },
  {
    imageUrl: LANDING_MEDIA.programSwiss,
    level: 'INTERMEDIATE',
    levelTone: 'secondary',
    duration: '18 Modules · 80 Hrs',
    metaIcon: 'architecture',
    metaLabel: 'Sub-Micron Precision Guide',
    title: 'Swiss Turn & Mill-Turn Precision Operations',
    description:
      'Master guide-bushing kinematics, synchronized sub-spindle handoffs, polygon turning, and micro-machining for medical bone-screws and satellite connectors.',
    tags: 'Citizen Cincom, Star Micronics, Esprit CAM',
    instructorInitials: 'EL',
    instructorName: 'Elena Lindqvist',
    href: '/academy',
  },
  {
    imageUrl: LANDING_MEDIA.programHybrid,
    level: 'ADVANCED',
    levelTone: 'accent',
    duration: '14 Modules · 70 Hrs',
    metaIcon: 'precision_manufacturing',
    metaLabel: 'DED + Multi-Axis Finish',
    title: 'Additive-Subtractive Hybrid & CAD/CAM Systems',
    description:
      'Combine laser metal deposition (DED) with high-speed surface passes. Program parametric adaptive toolpaths for remanufactured aerospace flight surfaces.',
    tags: 'DMG LASERTEC, Siemens NX CAM, Inconel 718',
    instructorInitials: 'JT',
    instructorName: 'Julian Thorne',
    href: '/academy',
  },
];

export function seedProgramCard(overrides: ProgramCardInput = {}): SeedResult {
  const item: ProgramCardInput = { ctaLabel: 'View Syllabus', ...LANDING_PROGRAMS[0], ...overrides };
  return leaf('program-card', { ...item });
}

export function seedProgramCards(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (LANDING_PROGRAMS as Record<string, unknown>[]);
  return packMulti(
    n('program-cards', {
      id: 'curriculum',
      paddingTop: 96,
      paddingBottom: 96,
      headerMarginBottom: 64,
      ...pick(overrides, ['id']),
    }),
    {
      header: [
        pack(
          n('stack', {
            direction: 'row',
            directionMobile: 'column',
            gap: 'lg',
            align: 'end',
            justify: 'between',
            className: 'flex flex-col md:flex-row md:items-end justify-between gap-6 w-full',
          }),
          'content',
          [
            pack(
              n('stack', {
                direction: 'column',
                gap: 'sm',
                align: 'start',
                justify: 'start',
                maxWidth: 640,
                className: 'max-w-2xl',
              }),
              'content',
              [
                leaf('text', {
                  text:
                    (overrides.eyebrow as string | undefined) ?? 'Accredited Specialization Paths',
                  size: 'xs',
                  uppercase: true,
                  tracking: '0.05em',
                  weight: 'bold',
                  color: 'text-primary',
                }),
                leaf('heading', {
                  as: 'h2',
                  size: 'headline-lg',
                  text:
                    (overrides.title as string | undefined) ??
                    'Master the Geometry of Micro-Tolerance Machining.',
                }),
              ],
            ),
            leaf('text', {
              text:
                (overrides.subtitle as string | undefined) ??
                'Engineered alongside aerospace manufacturing supervisors. Gain real spindle hours and remote CAM compilation certification.',
              size: 'md',
              color: 'text-text-secondary',
              maxWidth: 448,
            }),
          ],
        ),
      ],
      cards: list.map((item) => seedProgramCard(item as ProgramCardInput)),
    },
  );
}

// ------------------------------------------------------------------
// Digital twin (feature narrative + G-code terminal)
// ------------------------------------------------------------------

export interface TwinFeatureInput {
  icon?: string;
  title?: string;
  description?: string;
}

export const LANDING_TWIN_FEATURES: TwinFeatureInput[] = [
  {
    icon: 'memory',
    title: 'Instant G-Code Parsing',
    description:
      'Simulate full 500,000-line 5-axis toolpaths with instantaneous gouge detection in under 3 seconds.',
  },
  {
    icon: 'sensors',
    title: 'Renishaw Macro Telemetry',
    description:
      'Learn in-process surface probing, work-coordinate alignment routines, and automatic tool breakage detection.',
  },
  {
    icon: 'cloud_sync',
    title: 'Direct Post-Processor Library',
    description:
      'Export validated posts tailored for DMG Mori Celos, Fanuc 31i, Mazatrol SmoothX, and Heidenhain.',
  },
];

export const LANDING_TWIN_CODE: { text: string; tone: 'comment' | 'code' | 'highlight' | 'ok' }[] = [
  { text: '// INITIALIZE 5-AXIS VECTOR TRANSFORM (TRAORI / RTCP)', tone: 'comment' },
  { text: 'N100 G00 G90 G40 G17 G80 G49', tone: 'code' },
  { text: 'N110 G54.1 P1 (FIXTURE_DATUM_AIRCRAFT_DATUM)', tone: 'code' },
  { text: 'N120 T04 M06 (12MM 5-FLUTE SOLID CARBIDE BALLNOSE)', tone: 'code' },
  { text: 'N130 S18500 M03 M08 (THROUGH-SPINDLE COOLANT 70 BAR)', tone: 'code' },
  { text: 'N140 G43.4 H04 // DYNAMIC TOOL CENTER POINT (TCPM) ACTIVATED', tone: 'highlight' },
  { text: 'N150 G01 X+142.308 Y-84.119 Z+12.004 B-22.450 C+180.000 F4200.', tone: 'code' },
  { text: 'N160 X+144.110 Y-82.503 Z+11.890 B-21.980 C+181.250', tone: 'code' },
  { text: 'N170 X+146.002 Y-80.750 Z+11.750 B-21.200 C+182.900', tone: 'code' },
  { text: 'N180 >> COLLISION CLEARANCE: OK [TOLERANCE DELTA: +0.0018mm]', tone: 'ok' },
];

export const LANDING_TWIN_READOUTS: {
  label: string;
  value: string;
  tone: 'success' | 'normal' | 'accent' | 'primary';
}[] = [
  { label: 'COOLANT JET', value: 'ACTIVE 70 BAR', tone: 'success' },
  { label: 'CHIP LOAD (fz)', value: '0.082 mm/th', tone: 'normal' },
  { label: 'TOOL DEFLECTION', value: '0.003 mm', tone: 'accent' },
  { label: 'BUFFER EXEC', value: '1,024 BLOCKS/S', tone: 'primary' },
];

export function seedTwinSection(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (LANDING_TWIN_FEATURES as Record<string, unknown>[]);
  return packMulti(
    n('twin-section', {
      id: 'digital-twin',
      paddingTop: 80,
      paddingBottom: 80,
      sectionBg: 'bg-surface-container-low',
      className: 'border-t border-glass-border',
      fileName: 'TERMINAL_EXEC // AIRFRAME_SPAR_OP30.NC',
      statusLabel: 'SPINDLE ENGAGED',
      codeLines: LANDING_TWIN_CODE,
      readouts: LANDING_TWIN_READOUTS,
    }),
    {
      content: [
        leaf('text', {
          text: (overrides.eyebrow as string | undefined) ?? 'Browser-Native Physics Engine',
          size: 'xs',
          uppercase: true,
          tracking: '0.05em',
          weight: 'bold',
          color: 'text-primary',
          marginBottom: 8,
        }),
        leaf('heading', {
          as: 'h2',
          size: 'headline-lg',
          text:
            (overrides.title as string | undefined) ??
            'Zero-Penetration Digital Twin. Crash-Proof Before First Chip.',
          marginBottom: 24,
        }),
        leaf('text', {
          text:
            (overrides.subtitle as string | undefined) ??
            'Eliminate catastrophic $80,000 spindle collisions. Our cloud-rendered post-processor analyzes raw G-code blocks against complete machine kinematics and fixture clearances down to 0.001mm.',
          size: 'md',
          color: 'text-text-secondary',
          marginBottom: 32,
        }),
      ],
      features: list.map((item) => {
        const f = item as TwinFeatureInput;
        return packMulti(n('feature-item', { gap: 'gap-4' }), {
          content: [
            leaf('icon', { icon: f.icon ?? 'memory', size: 20, box: 'tinted' }),
            pack(
              n('stack', { direction: 'column', gap: 'none', align: 'stretch', justify: 'start' }),
              'content',
              [
                leaf('heading', { as: 'h4', size: 'md', text: f.title ?? '', marginBottom: 4 }),
                leaf('text', {
                  text: f.description ?? '',
                  size: 'sm',
                  color: 'text-text-secondary',
                }),
              ],
            ),
          ],
        });
      }),
    },
  );
}

// ------------------------------------------------------------------
// Testimonials (verified machinist reviews)
// ------------------------------------------------------------------

export interface TestimonialInput {
  quote?: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
  rating?: number;
}

export const LANDING_TESTIMONIALS: TestimonialInput[] = [
  {
    quote:
      '"Our DMG MORI DMU 50 was sitting under-utilized because no one in our region could confidently program 5-axis simultaneous impellers without fear of crashing the head. Machinist Pro gave my team the kinematic fluency and safe simulator sandbox we needed. Within two months, our cycle scrap rate dropped to practically zero."',
    name: 'Gareth Evans',
    role: 'Lead CAM Programmer · AeroDynamics Precision Group',
    avatarUrl: LANDING_MEDIA.reviewerGareth,
    rating: 5,
  },
  {
    quote:
      '"The Swiss Turn track is the only training material on earth that actually explains synchronous sub-spindle timing and vibration damping for titanium medical screws. I transitioned from a general 3-axis mill operator to a Tier-1 Swiss engineer earning over $115k annually."',
    name: 'Sarah Zhang',
    role: 'Senior Manufacturing Engineer · NexaMed Swiss Implantology',
    avatarUrl: LANDING_MEDIA.reviewerSarah,
    rating: 5,
  },
];

export function seedTestimonials(overrides: Record<string, unknown> = {}): SeedResult {
  const list = itemsOf(overrides) ?? (LANDING_TESTIMONIALS as Record<string, unknown>[]);
  return packMulti(
    n('testimonials', { paddingTop: 96, paddingBottom: 96, headerMarginBottom: 64 }),
    {
      header: [
        leaf('text', {
          text: (overrides.eyebrow as string | undefined) ?? 'Shop Floor Testimonials',
          size: 'xs',
          uppercase: true,
          tracking: '0.05em',
          weight: 'bold',
          color: 'text-primary',
          marginBottom: 8,
        }),
        leaf('heading', {
          as: 'h2',
          size: 'headline-lg',
          text:
            (overrides.title as string | undefined) ??
            'Trained by Industry Authorities. Endorsed by Machine Shops.',
        }),
      ],
      items: list.map((item) => leaf('testimonial-card', item as Record<string, unknown>)),
    },
  );
}

// ------------------------------------------------------------------
// Email CTA band
// ------------------------------------------------------------------

export function seedCtaSignup(overrides: Record<string, unknown> = {}): SeedResult {
  return leaf('cta-signup', {
    id: 'enroll',
    pill: 'Cohort 14 · Admissions Now Open',
    title: 'Scale Your Shop Floor Skills to the Micron Level.',
    subtitle:
      'Join over 17,400 aerospace and defense machinists worldwide. Secure your place in the upcoming 12-week intensive cohort.',
    placeholder: 'Enter your work email...',
    buttonLabel: 'Join Cohort',
    note: 'Instant access to Digital Twin simulator · 14-day zero-risk trial guarantee.',
    formAction: '/register',
    paddingTop: 80,
    paddingBottom: 80,
    ...overrides,
  });
}

// Full pages
// ------------------------------------------------------------------

/**
 * The canonical home page — a section-for-section port of the Machinist Pro
 * landing mockup:
 *   1. hero-console   — asymmetric editorial hero + simulator console card
 *   2. stats          — quick-stats deck (label, trend pill, value, note)
 *   3. partner-logos  — OEM wordmark strip
 *   4. program-cards  — specialization paths card grid
 *   5. twin-section   — digital-twin narrative + G-code terminal
 *   6. testimonials   — verified machinist reviews
 *   7. faq            — high-yield questions
 *   8. cta-signup     — gradient email-capture band
 *
 * Every section is a builder block: an admin can edit and republish each one in
 * the page builder and the public page renders the same components. Stats and
 * partner marks are content-managed (admin-authored), not hardcoded metrics.
 * Footer/nav are deliberately NOT seeded: the app chrome renders them and the
 * public renderer suppresses those block types.
 */
export function seedHomeLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedHeroConsole(),
    seedStatsDeck(),
    seedPartnerStrip(),
    seedAcademyGrid(),
    seedProgramCards(),
    seedTwinSection(),
    seedTestimonials(),
    seedFaq({
      id: 'faq',
      sectionBg: 'bg-surface-container-lowest',
      eyebrow: 'Clear Answers',
      title: 'Frequently Asked Questions',
      items: [
        {
          question: 'Do I need a physical 5-axis CNC machine to complete the cohort?',
          answer:
            'No. Our web-based Digital Twin console executes exact kinematic verification, post-processing, and toolpath physics. You will generate and verify production G-code directly in the browser. For cohort members wanting spindle time, we provide access to 140+ certified partner shop hubs worldwide for in-person machining test days.',
          icon: 'expand_more',
        },
        {
          question: 'Which CAM and Controller platforms are covered?',
          answer:
            'We cover industry-standard CAD/CAM systems including Siemens NX, Mastercam, Autodesk Fusion, and HyperMill. On the controller side, we teach direct macro programming and RTCP controls for Siemens Sinumerik 840D, Heidenhain TNC 640, Fanuc 30i/31i-B5, and Mazatrol SmoothX.',
          icon: 'expand_more',
        },
        {
          question: 'Can our manufacturing company enroll an entire tooling department?',
          answer:
            'Yes. We offer Enterprise Team Portals with manager oversight dashboards, custom post-processor calibration for your specific machines, and bespoke AS9100 audit compliance certifications.',
          icon: 'expand_more',
        },
        {
          question: 'What certification will I receive upon graduating?',
          answer:
            'You will receive the Machinist Pro Master Multi-Axis Credential, backed by OEM partners and cross-referenced with ISO 13485 and AS9100 Rev D manufacturing criteria.',
          icon: 'expand_more',
        },
      ],
    }),
    seedCtaSignup(),
  ];
  return toLayout(sections);
}



/** Academy-specific quick stats — capability statements paired with live catalog counts. */
export const ACADEMY_LANDING_STATS: StatCardInput[] = [
  {
    label: 'Academy Network',
    tag: 'Open Access',
    tagIcon: 'public',
    value: '4',
    sub: 'Specialized Academies',
    note: 'CNC Machining, Aerospace, Metalworking, and Automation & Robotics paths.',
  },
  {
    label: 'Learning Model',
    tag: 'Hands-on',
    tagIcon: 'school',
    tagVariant: 'primary',
    value: '100%',
    sub: 'Free Core Curriculum',
    note: 'Project-based courses with simulators and mentorship — no paywalls.',
  },
  {
    label: 'Delivery',
    tag: 'Remote-first',
    tagIcon: 'language',
    value: 'Online',
    sub: 'Global Classroom',
    note: 'Browser-native CAM and Digital Twin tools — learn from anywhere.',
  },
  {
    label: 'Outcome Focus',
    tag: 'Shop-ready',
    tagIcon: 'verified',
    value: 'Career',
    sub: 'Skills Shops Hire For',
    note: 'From machine setup to multi-axis programming across every discipline.',
  },
];

/** Academy-only spotlight programs — three signature paths featured under the live grid. */
export const ACADEMY_SPOTLIGHT_PROGRAMS: ProgramCardInput[] = [
  {
    imageUrl: LANDING_MEDIA.program5Axis,
    level: 'START HERE',
    levelTone: 'primary',
    duration: '36 Modules · Self-paced',
    metaIcon: 'precision_manufacturing',
    metaLabel: 'Mills, Lathes & G-code',
    title: 'CNC Machining Fundamentals',
    description:
      'Machine setup, work offsets, tool tables, and G-code mastery — the path every other academy builds on.',
    tags: 'Fanuc · Haas · Siemens basic cycles',
    instructorInitials: 'TC',
    instructorName: 'TITANS Core Faculty',
    href: '/academy/general',
    ctaLabel: 'Explore Path',
  },
  {
    imageUrl: LANDING_MEDIA.programSwiss,
    level: 'ADVANCED',
    levelTone: 'accent',
    duration: '48 Modules · Self-paced',
    metaIcon: 'verified',
    metaLabel: 'AS9100-aligned curriculum',
    title: 'Aerospace Precision Manufacturing',
    description:
      'Flight-hardware fixturing, tight-tolerance inspection, and documentation habits aerospace shops screen for.',
    tags: 'AS9100 · ISO 9001 · CMM inspection',
    instructorInitials: 'AP',
    instructorName: 'Aerospace Faculty',
    href: '/academy/aerospace',
    ctaLabel: 'Explore Path',
  },
  {
    imageUrl: LANDING_MEDIA.programHybrid,
    level: 'INTERMEDIATE',
    levelTone: 'secondary',
    duration: '30 Modules · Self-paced',
    metaIcon: 'settings_suggest',
    metaLabel: 'PLCs, robots & smart cells',
    title: 'Automation & Robotics',
    description:
      'Robot tending, PLC logic, and smart-factory workflows for the next generation of production cells.',
    tags: 'Allen-Bradley · FANUC iRPick · OPC-UA',
    instructorInitials: 'AR',
    instructorName: 'Automation Faculty',
    href: '/academy/automation',
    ctaLabel: 'Explore Path',
  },
];

/** Academy-only learning-model tiles (feature-tiles items). */
export const ACADEMY_LEARNING_MODEL: FeatureItemInput[] = [
  {
    icon: 'school',
    title: 'Project-based, not lecture-based',
    description:
      'Every module ends in a real setup, toolpath, or inspection you can show a hiring supervisor — not a multiple-choice quiz.',
  },
  {
    icon: 'terminal',
    title: 'Simulator built into every path',
    description:
      'Browser-native CAM and Digital Twin tools let you validate G-code before you ever touch a machine.',
  },
  {
    icon: 'verified',
    title: 'Credentials shops recognize',
    description:
      'Finish a path and earn an industry-aligned credential mapped to the skills shops actually screen for.',
  },
];

/**
 * Redesigned marketing landing pages — each section is a builder block that
 * reconstructs the bespoke UI. Live sections are `live-island` nodes whose
 * React content the public renderer substitutes by `variant`.
 *
 * Hero stats carry static defaults; the public renderer may inject live
 * catalog/feed/event counters over them without changing editor copy fields.
 */

function seedCatalogHero(overrides: Record<string, unknown> = {}): SeedResult {
  return leaf('catalog-hero', {
    paddingTop: catalogHeroDefaults.paddingTop,
    paddingBottom: catalogHeroDefaults.paddingBottom,
    ...overrides,
  });
}

function seedLiveIsland(variant: string, label: string, id?: string): SeedResult {
  return leaf('live-island', {
    variant,
    label,
    paddingTop: liveIslandDefaults.paddingTop,
    paddingBottom: liveIslandDefaults.paddingBottom,
    ...(id ? { id } : {}),
  });
}

function seedClosingCta(overrides: Record<string, unknown> = {}): SeedResult {
  return leaf('closing-cta', {
    paddingTop: closingCtaDefaults.paddingTop,
    paddingBottom: closingCtaDefaults.paddingBottom,
    ...overrides,
  });
}

/** Academy directory — catalog hero, live pathways, steps, spotlights, closing CTA. */
export function seedAcademyLandingLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedCatalogHero({
      eyebrow: 'Academy Catalog · Free Core',
      title: 'The floor has a',
      titleAccent: 'syllabus.',
      subtitle:
        'Four specialized academies. One mission: free, project-based manufacturing education that ends in credentials shops hire for — not certificates nobody reads.',
      stats: [
        { label: 'Academies', value: '4' },
        { label: 'Courses', value: '12' },
        { label: 'Price', value: '$0' },
        { label: 'Format', value: 'Self-paced' },
      ],
      primaryCta: { label: 'Browse pathways', href: '#pathways', variant: 'primary', icon: 'arrow_forward' },
      secondaryCta: { label: 'How it works', href: '#how-it-works', variant: 'secondary' },
      borderBottom: true,
    }),
    seedLiveIsland('academy-pathways', 'Academy pathways directory', 'pathways'),
    leaf('card-grid', {
      id: 'how-it-works',
      eyebrow: 'The model',
      title: 'Built like a shop, not a lecture hall.',
      subtitle:
        'Pick a path, cut real projects in the simulator, leave with credentials hiring managers trust. Three steps — no tuition, no gatekeeping.',
      items: [
        {
          title: 'Pick a path',
          body: 'Four specialized academies — CNC, Aerospace, Metalworking, Automation. Switch anytime; credits stick with you.',
          icon: 'graduation-cap',
        },
        {
          title: 'Cut real projects',
          body: 'Every module ends in a setup, toolpath, or inspection you can show a supervisor — simulated first, then on the floor.',
          icon: 'wrench',
        },
        {
          title: 'Earn the credential',
          body: 'Industry-aligned certificates shops already recognize. Free forever on the core curriculum.',
          icon: 'verified_user',
        },
      ],
      showNumbers: true,
      columns: 'md:grid-cols-3',
      band: 'sunken',
      paddingTop: 64,
      paddingBottom: 96,
    }),
    leaf('spotlight-cards', {
      id: 'spotlight-paths',
      eyebrow: 'Signature paths',
      title: 'Three routes into the floor',
      items: [
        { tag: 'START HERE', title: 'CNC Machining Fundamentals', meta: '36 Modules · Self-paced · Free', href: '/academy/general' },
        { tag: 'ADVANCED', title: 'Aerospace Precision Manufacturing', meta: '48 Modules · AS9100-aligned · Free', href: '/academy/aerospace' },
        { tag: 'INTERMEDIATE', title: 'Automation & Robotics', meta: '30 Modules · PLCs & robots · Free', href: '/academy/automation' },
      ],
      columns: 'md:grid-cols-3',
      band: 'none',
      paddingTop: 64,
      paddingBottom: 96,
    }),
    seedClosingCta({
      id: 'enroll',
      eyebrow: 'Enrollment open',
      title: 'Start free. Stay free.',
      body: 'Core curriculum across all four academies costs nothing — now and always. Pick a path and cut your first chip this week.',
      primaryLabel: 'Start with CNC',
      primaryHref: '/academy/general',
      primaryIcon: 'arrow_forward',
      secondaryLabel: 'Browse all courses',
      secondaryHref: '/courses',
      borderTop: true,
    }),
  ];
  return toLayout(sections);
}

/** Products storefront — hero, featured strip, inventory, departments, promises, CTA. */
export function seedProductsLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedCatalogHero({
      eyebrow: 'Tool crib · Free ship $99+',
      metaLine: 'Stocked for aerospace · medical · production',
      title: 'The tool crib,',
      titleAccent: 'open 24/7.',
      subtitle:
        'Workholding, cutters, metrology, and shop essentials — the same SKUs specified in our academy labs, ready to ship to your floor.',
      stats: [
        { label: 'SKUs', value: '—' },
        { label: 'Departments', value: '—' },
        { label: 'Price range', value: '—' },
        { label: 'Free ship at', value: '$99' },
      ],
      primaryCta: { label: 'Search inventory', href: '#inventory', variant: 'primary', icon: 'search' },
      secondaryCta: { label: 'Browse departments', href: '#departments', variant: 'secondary' },
      borderBottom: true,
    }),
    seedLiveIsland('products-featured', 'On the bench (featured)', 'on-the-bench'),
    seedLiveIsland('products-inventory', 'Live inventory catalog', 'inventory'),
    seedLiveIsland('products-departments', 'Department index', 'departments'),
    leaf('card-grid', {
      id: 'shop-promises',
      eyebrow: 'Why buy here',
      title: "Spec'd like the lab. Shipped like a supplier.",
      items: [
        {
          title: 'Free ship over $99',
          body: 'Continental US, 24h dispatch on stocked SKUs.',
          icon: 'local_shipping',
        },
        {
          title: 'Shop-verified specs',
          body: 'Every tool matches the academy lab BOM — no surprises.',
          icon: 'verified',
        },
        {
          title: '30-day returns',
          body: 'Unused tooling, original packaging, no restocking fee.',
          icon: 'inventory_2',
        },
        {
          title: 'Instant digital',
          body: 'Courses and downloads hit your account at checkout.',
          icon: 'rocket',
        },
      ],
      showNumbers: false,
      columns: 'sm:grid-cols-2 lg:grid-cols-4',
      band: 'none',
      paddingTop: 64,
      paddingBottom: 64,
    }),
    seedClosingCta({
      id: 'shop-cta',
      eyebrow: 'Pair it with a path',
      title: 'Learn it. Tool up for it.',
      body: 'Academy modules list the exact SKUs on the bench — train free, then stock the crib with what you already practiced on.',
      primaryLabel: 'Browse academies',
      primaryHref: '/academy',
      primaryIcon: 'arrow_forward',
      secondaryLabel: 'View cart',
      secondaryHref: '/cart',
      secondaryIcon: 'inventory_2',
      borderTop: true,
    }),
  ];
  return toLayout(sections);
}

/** Community wire — hero + ticker, topics, live wire, house rules, CTA. */
export function seedFeedLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedCatalogHero({
      eyebrow: 'Live wire · Public',
      eyebrowIcon: 'radio',
      metaLine: 'Machinists posting now',
      title: 'The floor is',
      titleAccent: 'talking.',
      subtitle:
        'Setups, scrap saves, feeds and speeds — the community channel where shop knowledge gets shared in public, not buried in a group chat.',
      stats: [
        { label: 'Posts on wire', value: '—' },
        { label: 'Topics', value: '—' },
        { label: 'Active authors', value: '—' },
        { label: 'Reactions', value: '—' },
      ],
      primaryCta: { label: 'Open the live wire', href: '#live-wire', variant: 'primary', icon: 'radio' },
      secondaryCta: { label: 'Learn the craft', href: '/academy', variant: 'secondary' },
      borderBottom: false,
    }),
    seedLiveIsland('feed-ticker', 'Wire traffic ticker', 'wire-ticker'),
    seedLiveIsland('feed-topics', 'Topic index', 'topics'),
    seedLiveIsland('feed-wire', 'Live wire + side rail', 'live-wire'),
    leaf('card-grid', {
      id: 'house-rules',
      eyebrow: 'House rules',
      title: 'Keep the wire useful.',
      subtitle: 'Three habits that separate a shop floor from a comment section.',
      items: [
        {
          title: 'Show the setup',
          body: 'Photos, speeds, feeds, fixtures — specifics beat vibes. If it cut well, prove it.',
          icon: 'auto_awesome',
        },
        {
          title: 'Ask like a pro',
          body: 'Machine, material, tool, and symptom. Incomplete questions get incomplete answers.',
          icon: 'forum',
        },
        {
          title: 'Leave the gatekeeping',
          body: "Apprentices and veterans share the same floor here. Mentor, don't mock.",
          icon: 'verified_user',
        },
      ],
      showNumbers: true,
      columns: 'md:grid-cols-3',
      band: 'sunken',
      paddingTop: 64,
      paddingBottom: 80,
    }),
    seedClosingCta({
      id: 'feed-cta',
      eyebrow: 'Jump in',
      title: 'Lurk less. Post the setup.',
      body: 'Signed-in members can open the composer from the wire — one post can save someone a scrapped part.',
      primaryLabel: 'Read the wire',
      primaryHref: '#live-wire',
      primaryIcon: 'arrow_forward',
      secondaryLabel: 'Start an academy',
      secondaryHref: '/academy',
      borderTop: false,
    }),
  ];
  return toLayout(sections);
}

/** Events hall — hero + format ticker, next-up, schedule, browse, formats, steps, CTA. */
export function seedEventsLayout(): PageLayout {
  const sections: SeedResult[] = [
    seedCatalogHero({
      eyebrow: 'Shop calendar · Live',
      eyebrowIcon: 'event',
      metaLine: 'Workshops · Webinars · Meets · Competitions',
      title: 'The floor has a',
      titleAccent: 'calendar.',
      subtitle:
        'Shoulder-to-shoulder workshops, free webinars, tournaments, and industry summits — built for machinists who learn by showing up.',
      stats: [
        { label: 'Upcoming', value: '—' },
        { label: 'Formats', value: '—' },
        { label: 'Cities', value: 'Online' },
        { label: 'Free seats', value: '—' },
      ],
      primaryCta: { label: 'View schedule', href: '#schedule', variant: 'primary', icon: 'event_available' },
      secondaryCta: { label: 'Browse all events', href: '#browse', variant: 'secondary' },
      borderBottom: false,
    }),
    seedLiveIsland('events-ticker', 'Format ticker', 'format-ticker'),
    seedLiveIsland('events-next-up', 'Next event spotlight', 'next-up'),
    seedLiveIsland('events-schedule', 'Schedule rail + side rail', 'schedule'),
    seedLiveIsland('events-browse', 'Full events board', 'browse'),
    leaf('card-grid', {
      id: 'formats',
      eyebrow: 'Formats',
      title: 'Four ways to show up',
      subtitle:
        'From a free lunch-and-learn webinar to a multi-day summit — pick the format that fits your floor.',
      items: [
        {
          title: 'Workshops',
          body: 'Hands-on days on real machines — limited seats, shop-floor pace, take-home setups.',
          icon: 'wrench',
        },
        {
          title: 'Webinars',
          body: 'Live online sessions on feeds, speeds, inspection, and process control. Free to join.',
          icon: 'monitor',
        },
        {
          title: 'Conferences',
          body: 'Multi-track industry summits — OEMs, shops, and educators under one roof.',
          icon: 'groups',
        },
        {
          title: 'Competitions',
          body: 'Tournaments and challenges where the clock, the print, and the finish all count.',
          icon: 'emoji_events',
        },
      ],
      showNumbers: true,
      columns: 'sm:grid-cols-2 lg:grid-cols-4',
      band: 'none',
      paddingTop: 64,
      paddingBottom: 64,
    }),
    leaf('card-grid', {
      id: 'how-to-attend',
      eyebrow: 'Registration',
      title: 'Three steps to a seat.',
      subtitle: 'Free events stay free. Workshops cap early. Everyone gets a clear confirmation.',
      items: [
        {
          title: 'Find your slot',
          body: 'Filter the board by format and date — workshops fill first, webinars stay open late.',
          icon: 'event',
        },
        {
          title: 'Register free',
          body: 'One click with your account. Seat counts update live; full events waitlist clearly.',
          icon: 'confirmation_number',
        },
        {
          title: 'Show up ready',
          body: 'Virtual links land in your inbox; in-person details include venue, parking, and gear list.',
          icon: 'event_available',
        },
      ],
      showNumbers: true,
      columns: 'md:grid-cols-3',
      band: 'sunken',
      note: 'Seat counts, waitlists, and cancellation status stay in sync on every event page.',
      paddingTop: 64,
      paddingBottom: 80,
    }),
    seedClosingCta({
      id: 'events-cta',
      eyebrow: 'Mark the date',
      title: 'Learn live. Then cut chips.',
      body: 'Pair an event with an academy path — train on the floor, then take the setup back to your shop.',
      primaryLabel: 'See the schedule',
      primaryHref: '#schedule',
      primaryIcon: 'event_available',
      secondaryLabel: 'Browse academies',
      secondaryHref: '/academy',
      borderTop: false,
    }),
  ];
  return toLayout(sections);
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

  const hero = section('border-b bg-surface-sunken/60 blueprint-grid', 96, 96, [
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

  // Qualitative claims only — no invented metrics.
  const stats = [
    { icon: 'bolt', value: 'Free', label: 'Core Courses, Forever' },
    { icon: 'public', value: 'Global', label: 'Remote-first Classroom' },
    { icon: 'school', value: 'Project-based', label: 'Curriculum Design' },
    { icon: 'verified', value: 'Industry-led', label: 'Instruction & Review' },
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
    { year: '2024', title: 'Rise to Greatness', desc: 'A global community of learners and partnerships with industry leaders.' },
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
    { icon: 'public', title: 'Global Community', desc: 'Members learning worldwide.' },
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
  'partner-logos': seedPartnerStrip,
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
  'catalog-hero': ((overrides) => seedCatalogHero(overrides)) as SeedFn,
  'card-grid': ((overrides) => leaf('card-grid', { ...cardGridDefaults, ...(overrides ?? {}) })) as SeedFn,
  'spotlight-cards': ((overrides) =>
    leaf('spotlight-cards', { ...spotlightCardsDefaults, ...(overrides ?? {}) })) as SeedFn,
  'closing-cta': ((overrides) => leaf('closing-cta', { ...closingCtaDefaults, ...(overrides ?? {}) })) as SeedFn,
  'live-island': ((overrides) =>
    leaf('live-island', { ...liveIslandDefaults, ...(overrides ?? {}) })) as SeedFn,
};

for (const [type, seed] of Object.entries(SEEDABLE)) {
  const def = BLOCK_REGISTRY[type];
  if (def) def.seed = seed;
}

export { SEEDABLE };
