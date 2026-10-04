import { Heart } from 'lucide-react';
export function FundedByBanner() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
      {' '}
      <Heart className="size-4 text-red-500" /> Free education made possible by our partners{' '}
    </div>
  );
}
