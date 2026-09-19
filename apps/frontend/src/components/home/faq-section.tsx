'use client';
import * as Accordion from '@radix-ui/react-accordion';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
const faqs = [
  {
    question: 'Do I need prior CNC experience to start?',
    answer:
      'Not at all. Our Digital Manufacturing Stack starts with fundamentals and safely carries you from basic shop terminology to advanced G-code logic.',
  },
  {
    question: 'How does the simulation-first pedagogy work?',
    answer:
      'You will program and run jobs in a virtual environment that reacts like a real machine, allowing you to fail safely and learn faster before operating equipment.',
  },
  {
    question: 'Are the certifications industry-recognized?',
    answer:
      'Yes. Our curriculum is developed with manufacturing professionals and includes secure, verifiable credentials you can share with employers.',
  },
  {
    question: 'Can I access the tool libraries on mobile?',
    answer:
      'Absolutely. The academy, technical resources, calculators, and tool libraries are fully responsive and optimized for use on the shop floor.',
  },
];
export function FaqSection() {
  return (
    <section className="bg-[#f3f4f5] px-4 py-24 md:px-10" aria-labelledby="faq-title">
      {' '}
      <div className="mx-auto max-w-4xl">
        {' '}
        <div className="mb-16 text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#7c3aed]">
            Support Center
          </p>
          <h2
            id="faq-title"
            className="font-display text-[44px] font-semibold leading-[1.2] text-[#111827]"
          >
            Frequently Asked Questions
          </h2>
        </div>{' '}
        <Accordion.Root type="single" collapsible className="space-y-4">
          {' '}
          {faqs.map((faq, index) => (
            <Accordion.Item
              key={faq.question}
              value={`item-${index}`}
              className="bg-white border border-gray-200 group overflow-hidden rounded-2xl border border-gray-200 transition-all duration-300"
            >
              {' '}
              <Accordion.Header>
                {' '}
                <Accordion.Trigger className="flex min-h-20 w-full items-center justify-between gap-4 px-8 py-6 text-left text-lg font-semibold text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600">
                  {' '}
                  {faq.question}{' '}
                  <Plus
                    className="h-5 w-5 shrink-0 text-[#7c3aed] transition-transform group-data-[state=open]:rotate-45"
                    aria-hidden="true"
                  />{' '}
                </Accordion.Trigger>{' '}
              </Accordion.Header>{' '}
              <Accordion.Content className="overflow-hidden leading-relaxed text-[#6b7280] opacity-80 data-[state=closed]:animate-[accordion-up_.2s_ease-out] data-[state=open]:animate-[accordion-down_.2s_ease-out]">
                {' '}
                <p className="px-8 pb-6">{faq.answer}</p>{' '}
              </Accordion.Content>{' '}
            </Accordion.Item>
          ))}{' '}
        </Accordion.Root>{' '}
        <div className="mt-16 text-center">
          {' '}
          <p className="mb-6 text-[#6b7280]">Still have questions?</p>{' '}
          <Link
            href="/about"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7c3aed] hover:underline"
          >
            Contact Technical Support <ArrowRight className="h-4 w-4" />
          </Link>{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
