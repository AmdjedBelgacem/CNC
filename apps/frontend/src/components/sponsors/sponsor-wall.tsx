'use client';
import { useQuery } from '@tanstack/react-query';
import { getImageSrc } from '@/lib/images';
interface Sponsor {
  id: string;
  name: string;
  tier: string | null;
  logoUrl: string | null;
}
export function SponsorWall({ tier, limit = 12 }: { tier?: string; limit?: number }) {
  const { data } = useQuery<{ data: Sponsor[] }>({
    queryKey: ['sponsors', tier, limit],
    queryFn: () =>
      fetch(`/api/proxy/sponsors?limit=${limit}${tier ? `&tier=${tier}` : ''}`, { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    enabled: true,
  });
  const sponsors = data?.data || [];
  if (sponsors.length === 0) return null;
  return (
    <div className="overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      {' '}
      <div className="flex w-max animate-marquee gap-6 hover:[animation-play-state:paused]">
        {' '}
        {[...sponsors, ...sponsors].map((s, i) => (
          <div
            key={`${s.id}-${i}`}
            className="flex shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card px-6 py-3 text-sm font-medium text-muted-foreground shadow-xs grayscale transition-[filter,opacity] duration-300 hover:grayscale-0"
          >
            {' '}
            <img src={getImageSrc(s.logoUrl, 'sponsor')} alt={s.name} className="h-8 object-contain" />

          </div>
        ))}{' '}
      </div>{' '}
    </div>
  );
}
