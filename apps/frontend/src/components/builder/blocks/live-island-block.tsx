'use client';
import type { LiveIslandProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { useIslandSummary } from './use-island-summary';

/**
 * Canvas representation of a live tenant-data island.
 *
 * On the public site the renderer intercepts `live-island` nodes and substitutes the real
 * section — the catalog inventory, the academy pathways, the feed wire — keyed by `variant`.
 * Those are async server components, so the editor genuinely cannot render them, and this used
 * to say so in a dashed box: "this stub only appears in the builder canvas".
 *
 * That was honest and useless. An admin placing an inventory section could not tell whether it
 * would render six products or none, and the phrase "renders live on the public site" invited
 * the conclusion that the canvas was simply broken. It now reports what the section resolves to
 * *right now*, read from the same public endpoints the site uses, and links to the rendered
 * result — so the canvas answers the question it was being asked instead of disclaiming it.
 */
export function LiveIslandBlock({ props }: BlockComponentProps<LiveIslandProps>) {
  const { id, className, label, variant } = props;
  const tenantSlug =
    (typeof document !== 'undefined' &&
      document.cookie
        .split('; ')
        .find((c) => c.startsWith('x-tenant-slug='))
        ?.split('=')[1]) ||
    'cnc-fundamentals';
  const summary = useIslandSummary(variant, tenantSlug);

  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop', className)}
      style={layoutStyle(props)}
    >
      <div className="max-w-container-max mx-auto">
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon name="bolt" className="size-6" />
          </div>

          <p className="font-display text-lg font-semibold text-foreground">
            {label || summary.label}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {variant} · live data
          </p>

          {summary.loading ? (
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Checking what this section will render…
            </p>
          ) : summary.failed ? (
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              This section renders live on the public site. Its data could not be read from here,
              so the canvas cannot show what visitors will see.
            </p>
          ) : (
            <>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                {summary.detail}
              </p>
              {summary.counts.length > 0 && (
                <ul className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {summary.counts.map((c) => (
                    <li
                      key={c}
                      className="rounded-full border border-primary/30 bg-background px-3 py-1 font-mono text-xs text-foreground"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {summary.href && (
            <a
              href={summary.href}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-4"
            >
              View as visitors see it
              <Icon name="external" className="size-3" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}