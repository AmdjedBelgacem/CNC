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
        'group flex flex-col rounded-lg border border-border bg-card p-6 shadow-xs transition-colors duration-200 hover:border-primary/40 hover:shadow-md',
        className,
      )}
      style={layoutStyle(props)}
    >
      {tag ? (
        <span className="mb-4 w-fit rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
          {tag}
        </span>
      ) : null}
      <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground">
        {title}
      </h3>
      {meta ? <p className="mt-2 font-mono text-xs text-muted-foreground">{meta}</p> : null}
      <span className="mt-6 inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
        Explore path
        <Icon
          name="arrow_forward"
          className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        />
      </span>
    </Link>
  );
}
