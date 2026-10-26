import type { PartnerLogosProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { LogoItemBlock } from './logo-item-block';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';

/** Eyebrow header above a glass logo wall. */
export function PartnerLogosBlock({ props, puck }: BlockComponentProps<PartnerLogosProps>) {
  const { id, className, logoGap = 'gap-12 md:gap-24', headerMarginBottom = 40, frame = 'wall' } = props;
  const preview = useBuilderLivePreview();
  const editing = Boolean(puck?.isEditing);
  const live = editing ? preview : null;

  const logos = live ? (
    live.loading ? (
      <div className="col-span-full flex flex-wrap items-center justify-center gap-8 py-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className="h-6 w-24 animate-pulse rounded bg-surface-sunken"
            aria-hidden
          />
        ))}
      </div>
    ) : live.sponsors.length === 0 ? (
      <div className="col-span-full rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground">
        No active partners — this strip is hidden on the live site.
      </div>
    ) : (
      live.sponsors.slice(0, 8).map((sponsor) => (
        <LogoItemBlock
          key={sponsor.id}
          props={{ className: 'hover:scale-100' }}
          puck={{
            renderSlot: () => (
              <span className="font-mono font-bold tracking-tight text-text-primary opacity-70 hover:opacity-100 transition-opacity text-sm sm:text-base">
                {sponsor.name}
              </span>
            ),
            getSlotData: () => [],
          }}
        />
      ))
    )
  ) : null;

  if (frame === 'strip') {
    return (
      <section id={id} className={cn('w-full', className)} style={layoutStyle(props)}>
        {' '}
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto text-center">
          {' '}
          <div style={{ marginBottom: headerMarginBottom }}>{puck.renderSlot('header')}</div>{' '}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-center">
            {' '}
            {live ? logos : puck.renderSlot('logos')}{' '}
          </div>{' '}
        </div>{' '}
      </section>
    );
  }
  return (
    <section
      id={id}
      className={cn('px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto', className)}
      style={layoutStyle(props)}
    >
      {' '}
      <div className="text-center" style={{ marginBottom: headerMarginBottom }}>
        {puck.renderSlot('header')}
      </div>{' '}
      <div
        className={cn(
          'bg-card border border-border rounded-3xl p-6 sm:p-8 md:p-12 flex flex-wrap items-center justify-center',
          logoGap,
        )}
      >
        {' '}
        {live ? logos : puck.renderSlot('logos')}{' '}
      </div>{' '}
    </section>
  );
}
