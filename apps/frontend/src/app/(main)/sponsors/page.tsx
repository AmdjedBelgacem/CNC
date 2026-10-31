'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ExternalLink, Crown, Shield, Medal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getImageSrc } from '@/lib/images';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
interface Sponsor {
  id: string;
  name: string;
  description: string | null;
  tier: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
}
const tierConfig: Record<string, { icon: typeof Crown; className: string; chip: string }> = {
  Platinum: {
    icon: Crown,
    className: 'border-primary/25 ring-1 ring-inset ring-primary/10',
    chip: 'bg-primary/10 text-primary',
  },
  Gold: { icon: Shield, className: 'border-warning/25', chip: 'bg-warning/10 text-warning' },
  Silver: { icon: Medal, className: 'border-border/70', chip: 'bg-muted text-muted-foreground' },
};
export default function SponsorsPage() {
  const t = useTranslations('pages.sponsors');
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
  // `tier` is a taxonomy key from the API — it stays English so the grouping and
  // `tierConfig` lookups keep matching; only the rendered label is localized.
  const tierLabels: Record<string, string> = {
    Platinum: t('tierPlatinum'),
    Gold: t('tierGold'),
    Silver: t('tierSilver'),
    General: t('tierGeneral'),
  };
  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border/70 py-20 text-center md:py-28">
        <div aria-hidden className="absolute inset-0 -z-10 ambient-wash" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 blueprint-grid opacity-70 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        />
        <div className="container mx-auto px-4">
          <h1 className="mx-auto mb-5 max-w-3xl text-balance font-display text-4xl font-medium tracking-[-0.025em] sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mb-9 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
          <Button asChild size="lg">
            <Link href="/partners">{t('becomePartner')}</Link>
          </Button>
        </div>
      </section>
      <section className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          {isLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          )}
          {error && (
            <Reveal className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
              <p className="text-muted-foreground">{t('loadFailed')}</p>
            </Reveal>
          )}
          {!isLoading && !error && sponsors.length === 0 && (
            <Reveal className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
              <h3 className="font-display text-xl font-medium">{t('emptyTitle')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('emptyHint')}</p>
            </Reveal>
          )}
          {tierOrder.map((tier) => {
            const items = grouped[tier];
            if (!items?.length) return null;
            const config = tierConfig[tier];
            const Icon = config?.icon || Shield;
            return (
              <div key={tier} className="mb-20 last:mb-0">
                <Reveal className="mb-8 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="font-display text-2xl font-medium tracking-[-0.018em] md:text-3xl">
                    {t('tierHeading', { tier: tierLabels[tier] ?? tier })}
                  </h2>
                </Reveal>
                <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((s, i) => (
                    <StaggerItem
                      key={s.id}
                      index={i}
                      className={`card-hover rounded-2xl border bg-card p-6 shadow-xs ${config?.className || 'border-border/70'}`}
                    >
                      <div className="mb-5 flex items-start justify-between">
                        <div className="flex size-14 items-center justify-center rounded-xl border border-border/70 bg-background p-2">
                          <img
                            src={getImageSrc(s.logoUrl, 'sponsor')}
                            alt={s.name}
                            className="size-10 object-contain"
                          />
                        </div>
                        {s.tier && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config?.chip || 'bg-muted text-muted-foreground'}`}
                          >
                            {tierLabels[s.tier] ?? s.tier}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-medium tracking-[-0.01em]">
                        {s.name}
                      </h3>
                      {s.description && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                      {s.websiteUrl && (
                        <a
                          href={s.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {t('visitWebsite')}{' '}
                          <ExternalLink className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </a>
                      )}
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
