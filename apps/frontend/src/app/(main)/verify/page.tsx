'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';

export default function VerifyIndexPage() {
  const router = useRouter();
  const [number, setNumber] = useState('');
  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <div className="mb-6 flex items-center gap-3">
        <BadgeCheck className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Verify a certificate</h1>
      </div>
      <p className="mb-6 text-muted-foreground">
        Enter the certificate number (e.g. TMF-2026-000001) to check a real
        issued credential.
      </p>
      <form
        className="flex gap-2"
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
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-primary dark:border-[#48484A] dark:bg-[#1D1D1F]"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Verify
        </button>
      </form>
    </div>
  );
}
