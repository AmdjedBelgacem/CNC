import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Baroot CNC Solutions brand mark: a soft clay tile carrying the eagle head mark,
 * a book-serif wordmark and a quiet sans subscript. One mark for navbar, footer,
 * auth, admin.
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
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-primary text-primary-foreground shadow-xs ring-1 ring-inset ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-3 group-active:scale-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand-mark.png"
          alt=""
          width={18}
          height={18}
          className="size-[18px] object-contain"
        />
      </span>
      <span className="flex flex-col justify-center leading-none">
        <span className="font-display text-[19px] font-medium leading-none tracking-[-0.015em] text-foreground">
          Baroot
        </span>
        {!compact && (
          <span className="mt-1 hidden text-[11px] font-medium leading-none tracking-[0.01em] text-muted-foreground sm:block">
            CNC Solutions
          </span>
        )}
      </span>
    </Link>
  );
}
