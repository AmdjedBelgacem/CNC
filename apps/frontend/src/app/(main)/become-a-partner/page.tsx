import type { Metadata } from 'next';
import PartnerApplicationForm from '@/components/partners/partner-application-form';

export const metadata: Metadata = {
  title: 'Become a partner',
  description: 'Partner with Baroot CNC Solutions.',
};

export default function BecomeAPartnerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Become a partner</h1>
        <p className="mt-2 text-muted-foreground">Join our growing network of sponsors, distributors and training centers.</p>
      </header>
      <PartnerApplicationForm />
    </div>
  );
}