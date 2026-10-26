import type { AcademyGridProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { AcademyCard } from '@/components/academy/academy-card';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

/** Header row plus a grid of academy cards. */
export function AcademyGridBlock({ props, puck }: BlockComponentProps<AcademyGridProps>) {
  const {
    className,
    headerMarginBottom = 64,
    cardsColumns = 'md:grid-cols-3',
    cardsGap = 'gap-8',
    limit,
  } = props;
  const id = (props as { id?: string }).id;
  const preview = useBuilderLivePreview();
  const editing = Boolean(puck?.isEditing);
  const live = editing ? preview : null;

  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div
        className="flex flex-col md:flex-row justify-between items-end"
        style={{ marginBottom: headerMarginBottom }}
      >
        {' '}
        {puck.renderSlot('header')}{' '}
      </div>{' '}
      <div className={cn('grid grid-cols-1', cardsColumns, cardsGap)}>
        {live ? (
          live.loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[360px] animate-pulse rounded-lg border border-border bg-surface-sunken"
                aria-hidden
              />
            ))
          ) : live.academies.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
              <p className="font-semibold text-foreground">No published academies</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This section is hidden on the live site until an academy is published.
              </p>
            </div>
          ) : (
            (limit ? live.academies.slice(0, limit) : live.academies).map((academy) => (
              <AcademyCard key={academy.id} academy={academy} />
            ))
          )
        ) : (
          puck.renderSlot('cards')
        )}
      </div>{' '}
    </section>
  );
}
