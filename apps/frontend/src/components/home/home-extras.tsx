import type { ReactNode } from 'react';
import Link from 'next/link';
import { HOMEPAGE_FAQ } from '@/lib/faq-content';
import { BRAND_NAME } from '@/lib/brand';

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
      className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8"
    >
      {header ?? (
        <h2
          id="faq-heading"
          className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          Frequently asked questions about CNC machining training
        </h2>
      )}
      {items ? (
        <div className="fixed-island-items mt-8 flex flex-col gap-8">{items}</div>
      ) : (
        <dl className="fixed-island-items mt-8 flex flex-col gap-8">
          {HOMEPAGE_FAQ.map((item) => (
            <div
              key={item.question}
              className="fixed-island-item border-b border-border pb-6"
            >
              <dt className="font-display text-lg font-semibold text-foreground">
                {item.question}
              </dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function HomeGuidesSection({ header }: IslandSlots) {
  return (
    <section
      aria-label={header ? 'CNC solutions, training and practical guides' : undefined}
      aria-labelledby={header ? undefined : 'cnc-guides-heading'}
      className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"
    >
      {header ?? (
        <>
          <h2
            id="cnc-guides-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            CNC solutions, training and practical guides
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Start with our CNC training materials, then review CNC solutions, implementation
            guidance and partner options for your shop or learning centre.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            <Link href="/learn" className="text-primary underline-offset-4 hover:underline">
              CNC guides
            </Link>{' '}
            ·{' '}
            <Link href="/courses" className="text-primary underline-offset-4 hover:underline">
              CNC courses
            </Link>{' '}
            ·{' '}
            <Link href="/products" className="text-primary underline-offset-4 hover:underline">
              CNC tools
            </Link>{' '}
            ·{' '}
            <Link
              href="/become-a-partner"
              className="text-primary underline-offset-4 hover:underline"
            >
              Become a partner
            </Link>
          </p>
        </>
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
      className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8"
    >
      {header ?? (
        <>
          <h2
            id="about-facts-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            About {BRAND_NAME}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {BRAND_NAME} is a manufacturing-education company. The following describes what it
            teaches and who it serves.
          </p>
        </>
      )}
      {items ? (
        <div className="fixed-island-items mt-8 flex flex-col gap-8">{items}</div>
      ) : (
        <dl className="fixed-island-items mt-8 flex flex-col gap-8">
          {ABOUT_FACTS.map((fact) => (
            <div
              key={fact.heading}
              className="fixed-island-item border-b border-border pb-6"
            >
              <dt className="font-display text-lg font-semibold text-foreground">
                {fact.heading}
              </dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{fact.body}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer ?? (
        <p className="mt-8 text-sm text-muted-foreground">
          Course catalogue, academies and pricing are listed on the{' '}
          <a href="/courses" className="underline underline-offset-4">
            courses page
          </a>
          . For cohort and institutional training, see{' '}
          <a href="/edu-purchases" className="underline underline-offset-4">
            educational purchasing
          </a>
          .
        </p>
      )}
    </section>
  );
}
