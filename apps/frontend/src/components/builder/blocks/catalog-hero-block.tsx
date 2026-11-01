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

/** Catalog hero: paper dot field, eyebrow row, serif H1, stats strip, CTAs. */
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
      className={cn('relative overflow-hidden', borderBottom && 'border-b border-border/70', className)}
      style={layoutStyle(props)}
    >
      <div className="absolute inset-0 ambient-wash" aria-hidden />
      <div
        className="absolute inset-0 blueprint-grid opacity-70 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
        aria-hidden
      />
      <div className="relative px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto pt-16 pb-14 md:pt-24 md:pb-20">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 shadow-xs backdrop-blur-sm">
            {eyebrowIcon ? (
              <Icon name={eyebrowIcon} className="size-3.5 text-primary" />
            ) : (
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgb(var(--c-primary)/0.15)]" />
            )}
            {eyebrow}
          </span>
          {metaLine ? (
            <span className="text-[13px] text-muted-foreground">
              {metaLine}
            </span>
          ) : null}
        </div>

        <h1 className="mt-7 max-w-3xl text-balance font-display text-4xl font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl md:text-[3.75rem]">
          {title}
          {titleAccent ? (
            <span className="block font-normal italic text-primary">{titleAccent}</span>
          ) : null}
        </h1>
        {subtitle ? (
          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}

        {showStats ? (
          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 shadow-xs sm:grid-cols-4">
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
