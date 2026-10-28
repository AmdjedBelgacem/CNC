'use client';
import type { CatalogHeroProps, CatalogHeroStat } from '@titan/shared';
import { isNodeArray } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { useCatalogStats } from './use-catalog-stats';
import { useBuilderLivePreview } from '@/components/builder/live-preview-context';
import { CatalogStatBlock, CatalogStatValueOverrides } from './catalog-stat-block';
import { CatalogCtaLink } from './catalog-cta-block';

/** Catalog hero: blueprint grid, badge row, accent H1, stats strip, CTAs. */
export function CatalogHeroBlock({
  props,
  puck,
  heroStats,
}: BlockComponentProps<CatalogHeroProps> & { heroStats?: CatalogHeroStat[] }) {
  const {
    id,
    className,
    eyebrow,
    eyebrowIcon,
    metaLine,
    title,
    titleAccent,
    subtitle,
    primaryCta,
    secondaryCta,
    borderBottom = true,
  } = props;

  // Stats and CTAs are child blocks. The legacy props remain the fallback for
  // rows that have not been migrated yet.
  const slotStatNodes = (puck.getSlotData?.('statItems') ?? []).filter(
    (node) => node.type === 'catalog-stat',
  );
  const hasSlotStats = slotStatNodes.length > 0;
  const legacyStats =
    Array.isArray(props.stats) && !isNodeArray(props.stats) ? props.stats : undefined;
  const preview = useBuilderLivePreview();
  const previewStats = preview?.heroStats ?? null;
  const liveLegacyStats = useCatalogStats(
    heroStats || hasSlotStats ? undefined : legacyStats,
  );
  const stats = heroStats ?? previewStats ?? liveLegacyStats;
  // Public pages that receive server-baked `heroStats` keep the exact previous
  // render (translated labels included). Everywhere else — the builder canvas
  // and public pages without a live override — render the real slot children so
  // each stat stays selectable, overlaying live values only on placeholders.
  const renderSlotStats = hasSlotStats && !heroStats;
  const liveStatOverrides =
    renderSlotStats && stats
      ? new Map(
          slotStatNodes
            .map((node, index) => {
              const nodeId = typeof node.props?.id === 'string' ? node.props.id : '';
              const value = stats[index]?.value;
              return nodeId && value !== undefined ? ([nodeId, value] as const) : null;
            })
            .filter((entry): entry is readonly [string, string] => entry !== null),
        )
      : null;
  const showStats = renderSlotStats || Boolean(stats && stats.length > 0) || Boolean(puck.isEditing);

  const slotActionNodes = puck.getSlotData?.('actions') ?? [];
  const hasSlotActions = slotActionNodes.length > 0;
  const showActions =
    hasSlotActions || Boolean(primaryCta || secondaryCta) || Boolean(puck.isEditing);

  return (
    <section
      id={id}
      className={cn('relative overflow-hidden', borderBottom && 'border-b border-border', className)}
      style={layoutStyle(props)}
    >
      <div className="absolute inset-0 blueprint-grid opacity-60" aria-hidden />
      <div
        className="absolute -top-28 end-10 size-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div className="relative px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary shadow-xs">
            {eyebrowIcon ? (
              <Icon name={eyebrowIcon} className="size-3.5" />
            ) : (
              <span className="size-1.5 rounded-full bg-primary" />
            )}
            {eyebrow}
          </span>
          {metaLine ? (
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {metaLine}
            </span>
          ) : null}
        </div>

        <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {title}
          {titleAccent ? <span className="block text-primary">{titleAccent}</span> : null}
        </h1>
        {subtitle ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}

        {showStats ? (
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {renderSlotStats ? (
              <CatalogStatValueOverrides.Provider value={liveStatOverrides}>
                {puck.renderSlot('statItems')}
              </CatalogStatValueOverrides.Provider>
            ) : stats && stats.length > 0 ? (
              stats.map((stat, index) => (
                <CatalogStatBlock
                  key={`${stat.label}-${index}`}
                  props={{ label: stat.label, value: stat.value }}
                  puck={puck}
                />
              ))
            ) : (
              puck.renderSlot('statItems')
            )}
          </dl>
        ) : null}

        {showActions ? (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasSlotActions || (!primaryCta && !secondaryCta && puck.isEditing) ? (
              puck.renderSlot('actions')
            ) : (
              <>
                {primaryCta ? (
                  <CatalogCtaLink
                    label={primaryCta.label}
                    href={primaryCta.href}
                    variant={primaryCta.variant ?? 'primary'}
                    icon={primaryCta.icon}
                  />
                ) : null}
                {secondaryCta ? (
                  <CatalogCtaLink
                    label={secondaryCta.label}
                    href={secondaryCta.href}
                    variant={secondaryCta.variant ?? 'secondary'}
                    icon={secondaryCta.icon}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
