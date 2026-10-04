'use client';
import type { LiveIslandProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/**
 * Editor placeholder for a live tenant-data island. On the public site the
 * renderer intercepts `live-island` nodes and substitutes the real section
 * (catalog rows, feed wire, events board, …) keyed by `variant`.
 */
export function LiveIslandBlock({ props }: BlockComponentProps<LiveIslandProps>) {
  const { id, className, label, variant } = props;
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop', className)}
      style={layoutStyle(props)}
    >
      <div className="max-w-container-max mx-auto">
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon name="bolt" className="size-6" />
          </div>
          <p className="font-display text-lg font-semibold text-foreground">
            {label || 'Live section'}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {variant} · renders live on the public site
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Data is loaded per request from the catalog, feed, or events API — this stub only
            appears in the builder canvas.
          </p>
        </div>
      </div>
    </section>
  );
}
