'use client';
import { useQuery } from '@tanstack/react-query';
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
    <div className="overflow-hidden py-4">
      {' '}
      <div className="flex animate-marquee gap-8">
        {' '}
        {[...sponsors, ...sponsors].map((s, i) => (
          <div
            key={`${s.id}-${i}`}
            className="flex shrink-0 items-center justify-center rounded-lg border bg-card px-6 py-3 text-sm font-medium text-muted-foreground"
          >
            {' '}
            {s.logoUrl ? (
              <img src={s.logoUrl} alt={s.name} className="h-8 object-contain" />
            ) : (
              s.name
            )}{' '}
          </div>
        ))}{' '}
      </div>{' '}
    </div>
  );
}
