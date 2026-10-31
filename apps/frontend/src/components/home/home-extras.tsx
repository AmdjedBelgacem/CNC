import type { ReactNode } from 'react';
import Link from 'next/link';
import { HOMEPAGE_FAQ } from '@/lib/faq-content';
import { BRAND_NAME } from '@/lib/brand';
import { ArrowUpRight } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';

/**
 * Repository-managed sections that appear after the editable builder layout.
 *
 * These are fixed editorial/SEO content rather than tenant data. They used to be
 * appended directly by the public routes, which meant the builder could not show
 * them at all. They are now `live-island` variants: the public route renders the
 * same component through its island map, and the builder previews it in an
 * iframe. One implementation, so the two cannot drift.
 *
 * The builder-authored slots (`header`, `items`, `footer`) replace the default
 * copy when present. The defaults remain the fallback for layouts that have not
 * been opened and saved in the builder yet.
 */
type IslandSlots = {
  header?: ReactNode;
  items?: ReactNode;
  footer?: ReactNode;
};

export function HomeFaqSection({ header, items }: IslandSlots) {
  return (
    <section
      aria-label={header ? 'Frequently asked questions about CNC machining training' : undefined}
      aria-labelledby={header ? undefined : 'faq-heading'}
      className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28 lg:px-8"
    >
      <Reveal>
        {header ?? (
          <h2
            id="faq-heading"
            className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl"
          >
            Frequently asked questions about CNC machining training
          </h2>
        )}
      </Reveal>
      {items ? (
        <div className="fixed-island-items mt-12 flex flex-col gap-8">{items}</div>
      ) : (
        <dl className="fixed-island-items mt-12 flex flex-col gap-8">
          {HOMEPAGE_FAQ.map((item) => (
            <Reveal
              key={item.question}
              className="fixed-island-item border-b border-border/70 pb-8"
            >
              <dt className="text-balance font-display text-xl font-medium tracking-[-0.012em] text-foreground">
                {item.question}
              </dt>
              <dd className="mt-3 text-pretty text-base leading-7 text-muted-foreground">
                {item.answer}
              </dd>
            </Reveal>
          ))}
        </dl>
      )}
    </section>
  );
}

const GUIDE_LINKS = [
  { href: '/learn', label: 'CNC guides' },
  { href: '/courses', label: 'CNC courses' },
  { href: '/products', label: 'CNC tools' },
  { href: '/become-a-partner', label: 'Become a partner' },
] as const;

export function HomeGuidesSection({ header }: IslandSlots) {
  return (
    <section
      aria-label={header ? 'CNC solutions, training and practical guides' : undefined}
      aria-labelledby={header ? undefined : 'cnc-guides-heading'}
      className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pb-32 lg:px-8"
    >
      {header ?? (
        <Reveal className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-12 shadow-xs sm:px-12 md:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 ambient-wash opacity-70"
          />
          <div className="relative">
            <h2
              id="cnc-guides-heading"
              className="max-w-2xl text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl"
            >
              CNC solutions, training and practical guides
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground">
              Start with our CNC training materials, then review CNC solutions, implementation
              guidance and partner options for your shop or learning centre.
            </p>
            <Stagger as="ul" className="mt-8 flex flex-wrap gap-2.5" inViewOnly>
              {GUIDE_LINKS.map((link, i) => (
                <StaggerItem as="li" key={link.href} index={i}>
                  <Link href={link.href} className="link-pill group">
                    {link.label}
                    <ArrowUpRight
                      aria-hidden
                      className="size-3.5 opacity-60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 rtl:-scale-x-100"
                    />
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
      )}
    </section>
  );
}

const ABOUT_FACTS: { heading: string; body: string }[] = [
  {
    heading: 'What Baroot CNC Solutions does',
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

export function AboutFactsSection({ header, items, footer }: IslandSlots) {
  return (
    <section
      aria-label={header ? `About ${BRAND_NAME}` : undefined}
      aria-labelledby={header ? undefined : 'about-facts-heading'}
      className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28 lg:px-8"
    >
      {header ?? (
        <Reveal>
          <h2
            id="about-facts-heading"
            className="text-balance font-display text-3xl font-medium tracking-[-0.022em] text-foreground sm:text-4xl"
          >
            About {BRAND_NAME}
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">
            {BRAND_NAME} is a manufacturing-education company. The following describes what it
            teaches and who it serves.
          </p>
        </Reveal>
      )}
      {items ? (
        <div className="fixed-island-items mt-12 flex flex-col gap-8">{items}</div>
      ) : (
        <dl className="fixed-island-items mt-12 flex flex-col gap-8">
          {ABOUT_FACTS.map((fact) => (
            <Reveal key={fact.heading} className="fixed-island-item border-b border-border/70 pb-8">
              <dt className="text-balance font-display text-xl font-medium tracking-[-0.012em] text-foreground">
                {fact.heading}
              </dt>
              <dd className="mt-3 text-pretty text-base leading-7 text-muted-foreground">
                {fact.body}
              </dd>
            </Reveal>
          ))}
        </dl>
      )}
      {footer ?? (
        <p className="mt-10 text-sm leading-6 text-muted-foreground">
          Course catalogue, academies and pricing are listed on the{' '}
          <a href="/courses" className="text-primary underline-offset-4 hover:underline">
            courses page
          </a>
          . For cohort and institutional training, see{' '}
          <a href="/edu-purchases" className="text-primary underline-offset-4 hover:underline">
            educational purchasing
          </a>
          .
        </p>
      )}
    </section>
  );
}
