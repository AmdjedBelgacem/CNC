import Link from 'next/link';
import type { SpotlightCardProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** One linked spotlight path card inside Spotlight Cards. */
export function SpotlightCardBlock({ props }: BlockComponentProps<SpotlightCardProps>) {
  const { tag, title, meta, href, className } = props;
  return (
    <Link
      href={href}
      className={cn(
        'card-hover group flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-xs md:p-7',
        className,
      )}
      style={layoutStyle(props)}
    >
      {tag ? (
        <span className="mb-5 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {tag}
        </span>
      ) : null}
      <h3 className="text-balance font-display text-xl font-medium leading-snug tracking-[-0.015em] text-foreground">
        {title}
      </h3>
      {meta ? <p className="mt-2 text-sm text-muted-foreground">{meta}</p> : null}
      <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-primary">
        Explore path
        <Icon
          name="arrow_forward"
          className="size-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
        />
      </span>
    </Link>
  );
}
