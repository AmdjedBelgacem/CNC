import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BlockRenderer } from '@/components/builder/block-renderer';
import { resolvePageLayout } from '@/lib/builder/theme';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { BRAND_NAME, OG_IMAGE, absoluteUrl } from '@/lib/brand';
import { aboutJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} teaches CNC machining through simulation-first courses and industry-recognised certification, serving machinists, engineers and manufacturing teams.`,
  // Was the relative '/about', which resolved against the wrong metadataBase and produced
  // a canonical pointing at a different origin than the one serving the page.
  alternates: { canonical: absoluteUrl('/about') },
  openGraph: {
    type: 'profile',
    title: `About ${BRAND_NAME}`,
    description: `Who ${BRAND_NAME} is, what it teaches, and who it serves.`,
    url: absoluteUrl('/about'),
    siteName: BRAND_NAME,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `About ${BRAND_NAME}`,
    description: `Who ${BRAND_NAME} is, what it teaches, and who it serves.`,
    images: [OG_IMAGE.url],
  },
};

/**
 * Entity facts, rendered server-side.
 *
 * The About page body comes from the CMS builder, so its exact wording is data rather than
 * code and could be edited to anything. Generative engines need plain, attributable
 * statements about who the organisation is and what it does; without a guaranteed block of
 * factual prose the page relies entirely on CMS content being present and correct. This
 * section is fixed in the repository, so the entity description cannot silently disappear.
 */
const FACTS: { heading: string; body: string }[] = [
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

export default async function AboutPage() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const layout = await resolvePageLayout(tenantSlug, 'about');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutJsonLd()) }}
      />
      <BlockRenderer layout={layout} />

      <section
        aria-labelledby="about-facts-heading"
        className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8"
      >
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
        <dl className="mt-8 space-y-8">
          {FACTS.map((fact) => (
            <div key={fact.heading} className="border-b border-border pb-6 last:border-b-0">
              <dt className="font-display text-lg font-semibold text-foreground">{fact.heading}</dt>
              <dd className="mt-2 text-base leading-7 text-muted-foreground">{fact.body}</dd>
            </div>
          ))}
        </dl>
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
      </section>
    </>
  );
}
