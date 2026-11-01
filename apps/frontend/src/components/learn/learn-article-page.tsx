import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Reveal, ScrollProgress } from '@/components/ui/motion';
import { organizationJsonLd } from '@/lib/brand';
import { learnArticleJsonLd, faqJsonLd, breadcrumbJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';
import { BRAND_NAME } from '@/lib/brand';
import type { LearnArticle } from '@/lib/learn-content';

interface LearnArticlePageProps {
  article: LearnArticle;
}

export function LearnArticlePage({ article }: LearnArticlePageProps) {
  const articleNode = { '@context': 'https://schema.org', ...learnArticleJsonLd(article) };
  const faqNode = { '@context': 'https://schema.org', ...faqJsonLd(article.faqs) };
  const orgNode = { '@context': 'https://schema.org', ...organizationJsonLd() };
  const crumbNode = {
    '@context': 'https://schema.org',
    ...breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Learn', path: '/learn' },
      { name: article.h1, path: article.path },
    ]),
  };

  return (
    <>
      {[articleNode, faqNode, orgNode, crumbNode].map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
      <ScrollProgress className="z-[60]" />
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] ambient-wash opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <article className="mx-auto max-w-[46rem] px-4 pb-24 pt-14 sm:px-6 md:pt-20 lg:px-8">
          <nav
            className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground"
            data-breadcrumb
            aria-label="Breadcrumb"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <ChevronRight aria-hidden className="size-3.5 opacity-50 rtl:rotate-180" />
            <span className="text-foreground/80">Learn</span>
          </nav>
          <header className="pb-10">
            <h1 className="text-balance font-display text-4xl font-medium leading-[1.06] tracking-[-0.026em] text-foreground sm:text-5xl">
              {article.h1}
            </h1>
            {/* Direct answer first. Target 40-60 words so answer engines can lift it. */}
            <p className="mt-8 rounded-2xl border border-border/70 bg-card px-6 py-5 text-pretty text-lg leading-8 text-foreground shadow-xs">
              <span className="font-medium text-primary">Answer: </span>
              {article.answer}
            </p>
          </header>

          <div className="space-y-14">
            {article.sections.map((section) => (
              <Reveal
                as="section"
                key={section.heading}
                className="border-t border-border/70 pt-10"
              >
                <h2 className="text-balance font-display text-[1.75rem] font-medium leading-snug tracking-[-0.018em] text-foreground">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph, index) => (
                  <p
                    key={index}
                    className="mt-4 text-pretty text-[17px] leading-[1.8] text-foreground/80"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-5 space-y-2.5 text-[17px] text-foreground/80">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="relative ps-6 leading-[1.75]">
                        <span
                          aria-hidden
                          className="absolute start-1 top-[0.7em] size-1.5 rounded-full bg-primary/70"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Reveal>
            ))}

            <Reveal
              as="section"
              aria-labelledby="related-links"
              className="border-t border-border/70 pt-10"
            >
              <h2
                id="related-links"
                className="text-balance font-display text-[1.75rem] font-medium leading-snug tracking-[-0.018em] text-foreground"
              >
                Related CNC guides, training and products
              </h2>
              <p className="mt-4 text-[17px] leading-[1.8] text-foreground/80">
                Explore courses, technical resources and partner pathways for practical CNC work.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2.5">
                {article.related.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="link-pill group">
                      {item.label}
                      <ArrowRight
                        aria-hidden
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal
              as="section"
              aria-labelledby="faq-heading"
              className="border-t border-border/70 pt-10"
            >
              <h2
                id="faq-heading"
                className="text-balance font-display text-[1.75rem] font-medium leading-snug tracking-[-0.018em] text-foreground"
              >
                Frequently asked questions about {article.h1.replace(/\?$/, '')}
              </h2>
              <dl className="mt-8 space-y-4">
                {article.faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs"
                  >
                    <dt className="font-display text-lg font-medium tracking-[-0.01em] text-foreground">
                      {faq.question}
                    </dt>
                    <dd className="mt-2 text-pretty text-base leading-7 text-muted-foreground">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div className="mt-16 flex items-center gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-medium text-primary"
            >
              {BRAND_NAME.charAt(0)}
            </span>
            <span>
              {BRAND_NAME} writes these guides for machinists, engineers and manufacturing teams.
              Author: editorial team at {BRAND_NAME}.
            </span>
          </div>
        </article>
      </div>
    </>
  );
}
