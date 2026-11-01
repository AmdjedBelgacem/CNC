import { Heart } from 'lucide-react';
export function FundedByBanner() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-xs">
      {' '}
      <Heart className="size-4 fill-primary/15 text-primary" /> Free education made possible by our partners{' '}
    </div>
  );
}
