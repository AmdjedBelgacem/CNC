'use client';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Crown, Shield, Medal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getImageSrc } from '@/lib/images';
interface Sponsor {
  id: string;
  name: string;
  description: string | null;
  tier: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
}
const tierConfig: Record<string, { icon: typeof Crown; className: string }> = {
  Platinum: { icon: Crown, className: 'border-yellow-500/50 bg-yellow-500/5' },
  Gold: { icon: Shield, className: 'border-yellow-600/30 bg-yellow-600/5' },
  Silver: { icon: Medal, className: 'border-border bg-muted/40' },
};
export default function SponsorsPage() {
  const { data, isLoading, error } = useQuery<{ data: Sponsor[] }>({
    queryKey: ['sponsors'],
    queryFn: () =>
      fetch('/api/proxy/sponsors?limit=50', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    retry: 2,
  });
  const sponsors = data?.data || [];
  const grouped: Record<string, Sponsor[]> = {};
  for (const s of sponsors) {
    const tier = s.tier || 'General';
    if (!grouped[tier]) grouped[tier] = [];
    grouped[tier].push(s);
  }
  const tierOrder = ['Platinum', 'Gold', 'Silver', 'General'];
  return (
    <div>
      {' '}
      <section className="border-b bg-surface-sunken/60 blueprint-grid py-20 text-center">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">Our Partners</h1>{' '}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {' '}
            Free manufacturing education is made possible by the generous support of our industry
            partners.{' '}
          </p>{' '}
          <Button asChild size="lg">
            {' '}
            <Link href="/contact">Become a Partner</Link>{' '}
          </Button>{' '}
        </div>{' '}
      </section>{' '}
      <section className="py-16">
        {' '}
        <div className="container mx-auto px-4">
          {' '}
          {isLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {' '}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}{' '}
            </div>
          )}{' '}
          {error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <p className="text-muted-foreground">
                Unable to load partners. Make sure the backend is running.
              </p>{' '}
            </div>
          )}{' '}
          {!isLoading && !error && sponsors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {' '}
              <h3 className="text-lg font-semibold">No partners yet</h3>{' '}
              <p className="text-sm text-muted-foreground mt-1">
                Partner listings will appear once published.
              </p>{' '}
            </div>
          )}{' '}
          {tierOrder.map((tier) => {
            const items = grouped[tier];
            if (!items?.length) return null;
            const config = tierConfig[tier];
            const Icon = config?.icon || Shield;
            return (
              <div key={tier} className="mb-16 last:mb-0">
                {' '}
                <div className="flex items-center gap-3 mb-6">
                  {' '}
                  <Icon className="size-5 text-primary" />{' '}
                  <h2 className="text-2xl font-bold">{tier} Partners</h2>{' '}
                </div>{' '}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {' '}
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className={`rounded-xl border bg-card p-6 transition-all hover:shadow-lg ${config?.className || ''}`}
                    >
                      {' '}
                      <div className="flex items-start justify-between mb-3">
                        {' '}
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/50 font-bold text-sm">
                          {' '}
                          <img
                            src={getImageSrc(s.logoUrl, 'sponsor')}
                            alt={s.name}
                            className="h-10 w-10 object-contain"
                          />
                        </div>{' '}
                        {s.tier && (
                          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                            {s.tier}
                          </span>
                        )}{' '}
                      </div>{' '}
                      <h3 className="font-bold">{s.name}</h3>{' '}
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {s.description}
                        </p>
                      )}{' '}
                      {s.websiteUrl && (
                        <a
                          href={s.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary mt-3 hover:underline"
                        >
                          {' '}
                          Visit website <ExternalLink className="size-3.5" />{' '}
                        </a>
                      )}{' '}
                    </div>
                  ))}{' '}
                </div>{' '}
              </div>
            );
          })}{' '}
        </div>{' '}
      </section>{' '}
    </div>
  );
}
