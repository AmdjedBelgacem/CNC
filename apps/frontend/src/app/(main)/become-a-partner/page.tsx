import type { Metadata } from 'next';
import PartnerApplicationForm from '@/components/partners/partner-application-form';
import { Reveal } from '@/components/ui/motion';

export const metadata: Metadata = {
  title: 'Become a partner',
  description: 'Partner with Baroot CNC Solutions.',
};

export default function BecomeAPartnerPage() {
  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] ambient-wash [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="mx-auto max-w-2xl space-y-10 px-6 pb-24 pt-16 md:pt-24">
        <Reveal as="header">
          <h1 className="text-balance font-display text-4xl font-medium tracking-[-0.025em] sm:text-5xl">
            Become a partner
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Join our growing network of sponsors, distributors and training centers.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <PartnerApplicationForm />
        </Reveal>
      </div>
    </div>
  );
}
