import type { Metadata } from 'next';
import Link from 'next/link';
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
  const crumbNode = { '@context': 'https://schema.org', ...breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Learn', path: '/learn' }]) };
  return (
    <>
      {[orgNode, crumbNode].map((node, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }} />
      ))}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">CNC guides and solutions</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Answer: CNC solutions start with fundamentals. Explore clear guides on what CNC stands for, what CNC machining is, G-code, machine selection, and how training helps machinists and engineering teams.
        </p>
        <ul className="mt-8 space-y-3">
          {guides.map((guide) => (
            <li key={guide.href}>
              <Link href={guide.href} className="text-primary underline-offset-4 hover:underline">
                {guide.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-base text-muted-foreground">
          Browse <Link href="/courses" className="text-primary underline-offset-4 hover:underline">CNC training courses</Link>,{' '}
          <Link href="/products" className="text-primary underline-offset-4 hover:underline">manufacturing products</Link>, and{' '}
          <Link href="/become-a-partner" className="text-primary underline-offset-4 hover:underline">partner opportunities</Link> to continue.
        </p>
      </div>
    </>
  );
}
