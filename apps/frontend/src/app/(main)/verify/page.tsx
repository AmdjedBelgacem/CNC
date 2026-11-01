'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { Reveal } from '@/components/ui/motion';

export default function VerifyIndexPage() {
  const router = useRouter();
  const [number, setNumber] = useState('');
  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] ambient-wash [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="container mx-auto max-w-xl px-4 pb-24 pt-16 md:pt-24">
        <Reveal>
          <span className="mb-6 flex size-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/15">
            <BadgeCheck className="size-7" />
          </span>
          <h1 className="text-balance font-display text-4xl font-medium tracking-[-0.025em]">
            Verify a certificate
          </h1>
          <p className="mb-8 mt-4 text-pretty leading-relaxed text-muted-foreground">
            Enter the certificate number (e.g. TMF-2026-000001) to check a real issued credential.
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <form
            className="flex gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:shadow-[0_0_0_4px_rgb(var(--c-ring)/0.12)]"
            onSubmit={(e) => {
              e.preventDefault();
              const v = number.trim();
              if (v) router.push(`/verify/${encodeURIComponent(v)}`);
            }}
          >
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="TMF-2026-000001"
              className="w-full bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="submit"
              className="pressable shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Verify
            </button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
