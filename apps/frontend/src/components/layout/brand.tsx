import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Baroot CNC Solutions brand mark: safety-orange squared tile carrying the eagle head
 * mark, grotesque wordmark, mono subscript. One mark for navbar, footer, auth, admin.
 *
 * `brand-mark.png` is a crop of `logo.png` (the full artwork is a wide, hairline outline
 * drawing that turns to mush below ~40px). This derivative is 9KB against the original's
 * 1.2MB, and is drawn at 18px inside the 32px tile: at 22px its ink reached the tile edge,
 * at 18px there is a clear orange margin on every side while the silhouette still reads.
 */
export function BrandMark({
  href = '/',
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn('group flex shrink-0 items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand-mark.png"
          alt=""
          width={18}
          height={18}
          className="size-[18px] object-contain transition-transform group-hover:scale-105"
        />
      </span>
      <span className="flex flex-col justify-center leading-none">
        <span className="font-display text-[14px] font-bold uppercase tracking-[0.14em] text-foreground">
          Baroot
        </span>
        {!compact && (
          <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground sm:block">
            CNC Solutions
          </span>
        )}
      </span>
    </Link>
  );
}
