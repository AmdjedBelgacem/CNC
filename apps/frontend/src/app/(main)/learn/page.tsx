import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/ui/motion';
import { createPageMetadata } from '@/lib/metadata';
import { organizationJsonLd } from '@/lib/brand';
import { breadcrumbJsonLd } from '@/lib/schema';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = createPageMetadata(
  'CNC guides and solutions: training for machinists and engineers',
  'Direct, practical answers about CNC, CNC machining, G-code, mill vs lathe, and CNC solutions for teams.',
  '/learn',
);

const guides = [
  { href: '/learn/what-does-cnc-stand-for', title: 'What does CNC stand for?' },
  { href: '/learn/what-is-cnc-machining', title: 'What is CNC machining?' },
  { href: '/learn/cnc-solutions', title: 'CNC solutions and training' },
  { href: '/learn/cnc-mill-vs-lathe', title: 'CNC mill vs lathe' },
  { href: '/learn/g-code-basics', title: 'G-code basics' },
];

export default function LearnPage() {
  const orgNode = { '@context': 'https://schema.org', ...organizationJsonLd() };
  const crumbNode = {
    '@context': 'https://schema.org',
    ...breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Learn', path: '/learn' },
    ]),
  };
  return (
    <>
      {[orgNode, crumbNode].map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] ambient-wash opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 md:pt-24 lg:px-8">
          <h1 className="text-balance font-display text-4xl font-medium leading-[1.06] tracking-[-0.026em] text-foreground sm:text-5xl">
            CNC guides and solutions
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
            Answer: CNC solutions start with fundamentals. Explore clear guides on what CNC stands
            for, what CNC machining is, G-code, machine selection, and how training helps machinists
            and engineering teams.
          </p>
          <Stagger as="ul" className="mt-12 flex flex-col gap-3">
            {guides.map((guide, i) => (
              <StaggerItem as="li" key={guide.href} index={i}>
                <Link
                  href={guide.href}
                  className="card-hover group flex items-center justify-between gap-6 rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-xs"
                >
                  <span className="flex items-baseline gap-4">
                    <span
                      aria-hidden
                      className="font-display text-sm text-muted-foreground/60 tabular-nums"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-xl font-medium tracking-[-0.012em] text-foreground">
                      {guide.title}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-12 text-base leading-7 text-muted-foreground">
            Browse{' '}
            <Link href="/courses" className="text-primary underline-offset-4 hover:underline">
              CNC training courses
            </Link>
            ,{' '}
            <Link href="/products" className="text-primary underline-offset-4 hover:underline">
              manufacturing products
            </Link>
            , and{' '}
            <Link
              href="/become-a-partner"
              className="text-primary underline-offset-4 hover:underline"
            >
              partner opportunities
            </Link>{' '}
            to continue.
          </p>
        </div>
      </div>
    </>
  );
}
