import Link from 'next/link';
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
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground" data-breadcrumb>
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>{' '}
          / Learn
        </p>
        <header className="border-b border-border pb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            {article.h1}
          </h1>
          {/* Direct answer first. Target 40-60 words so answer engines can lift it. */}
          <p className="mt-4 text-lg leading-8 text-foreground">
            <span className="font-semibold">Answer: </span>
            {article.answer}
          </p>
        </header>

        <div className="mt-8 space-y-10">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph, index) => (
                <p key={index} className="mt-3 text-base leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-4 space-y-2 text-base text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="ml-5 list-disc leading-7">
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section aria-labelledby="related-links">
            <h2 id="related-links" className="text-2xl font-semibold tracking-tight text-foreground">
              Related CNC guides, training and products
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Explore courses, technical resources and partner pathways for practical CNC work.
            </p>
            <ul className="mt-4 space-y-2 text-base text-muted-foreground">
              {article.related.map((item) => (
                <li key={item.href} className="ml-5 list-disc leading-7">
                  <Link href={item.href} className="text-primary underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-foreground">
              Frequently asked questions about {article.h1.replace(/\?$/, '')}
            </h2>
            <dl className="mt-6 space-y-8">
              {article.faqs.map((faq) => (
                <div key={faq.question} className="border-b border-border pb-6 last:border-b-0">
                  <dt className="text-lg font-semibold text-foreground">{faq.question}</dt>
                  <dd className="mt-2 text-base leading-7 text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          {BRAND_NAME} writes these guides for machinists, engineers and manufacturing teams. Author:
          editorial team at {BRAND_NAME}.
        </div>
      </article>
    </>
  );
}
