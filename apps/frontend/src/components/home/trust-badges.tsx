import { Shield, GraduationCap, HeadphonesIcon, Globe } from 'lucide-react';

/**
 * Trust strip.
 *
 * The previous copy asserted "4.5M+ members worldwide" — a fabricated metric with
 * no source. Claims here must be either product facts the tenant controls or
 * omitted entirely. An optional `memberCount` lets the caller show a REAL number
 * when one is available; otherwise the badge falls back to non-numeric copy.
 */
const badges = [
  { icon: Shield, title: 'Built for Industry', description: 'Curriculum shaped by working machinists.' },
  {
    icon: GraduationCap,
    title: 'Free to Start',
    description: 'Introductory courses are free — no card required.',
  },
  { icon: HeadphonesIcon, title: 'Instructor Support', description: 'Ask questions in the course feed.' },
  {
    icon: Globe,
    title: 'Global Community',
    description: 'Machinists learning together across every time zone.',
  },
];

export function TrustBadges({ memberCount }: { memberCount?: number | null } = {}) {
  const hasRealCount = typeof memberCount === 'number' && memberCount > 0;
  const items = badges.map((b) =>
    b.title === 'Global Community' && hasRealCount
      ? { ...b, description: `${memberCount!.toLocaleString()} members and counting.` }
      : b,
  );
  return (
    <section className="border-t border-border bg-secondary/10 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {items.map((b) => (
            <div key={b.title} className="text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <b.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
