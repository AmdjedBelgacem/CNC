'use client';
import type { HeroConsoleProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';

/** Dark glass telemetry panel treatment (console mockup overlays). */
const DARK_GLASS = 'bg-overlay/85 backdrop-blur-md border border-white/10 shadow-lg text-white';

/**
 * Asymmetric editorial hero: left column is the builder `content` slot
 * (badge, headline, copy, CTAs, trust row); right column is the CNC
 * simulator console card — header bar, viewport with telemetry overlays,
 * kinematic axis drawer, mode selector, and a floating metric badge.
 */
export function HeroConsoleBlock({ props, puck }: BlockComponentProps<HeroConsoleProps>) {
  const {
    id,
    className,
    imageUrl,
    imageAlt = '',
    fileName,
    syncLabel,
    feedLabel,
    feedValue,
    feedTag,
    spindleLabel,
    spindleValue,
    spindleTag,
    auditTitle,
    auditValue,
    axesTitle,
    vibration,
    axes = [],
    modes = [],
    controllerLabel,
    floatIcon,
    floatLabel,
    floatValue,
    floatTag,
  } = props;
  return (
    <section id={id} className={cn('relative overflow-hidden', className)} style={layoutStyle(props)}>
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left: value proposition column */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {puck.renderSlot('content')}
          </div>
          {/* Right: simulator console card */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-2xl p-2 liquid-glass shadow-xl">
              {/* Console header bar */}
              <div className="bg-card rounded-lg p-3 mb-2 flex items-center justify-between border-b border-glass-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="size-2.5 rounded-full bg-destructive/70"></span>
                    <span className="size-2.5 rounded-full bg-warning/70"></span>
                    <span className="size-2.5 rounded-full bg-success/70"></span>
                  </div>
                  {fileName ? (
                    <span className="text-xs font-mono text-text-muted ms-2 truncate">
                      {fileName}
                    </span>
                  ) : null}
                </div>
                {syncLabel ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded bg-success/15 text-success font-semibold shrink-0">
                    <span className="size-1.5 rounded-full bg-success animate-pulse"></span>
                    {syncLabel}
                  </span>
                ) : null}
              </div>
              {/* Viewport */}
              <div className="relative h-[380px] sm:h-[440px] rounded-lg overflow-hidden group bg-surface-sunken">
                {/* Intentional blueprint backdrop: visible if the remote image fails. */}
                <div className="absolute inset-0 blueprint-grid" aria-hidden="true"></div>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={imageAlt}
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                {/* Telemetry badges (top-left) */}
                <div className="absolute top-4 start-4 flex flex-col gap-2 z-20">
                  {feedValue ? (
                    <div
                      className={cn(
                        DARK_GLASS,
                        'px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-3',
                      )}
                    >
                      <span className="text-white/60">{feedLabel}</span>
                      <span className="font-bold text-sm">{feedValue}</span>
                      {feedTag ? (
                        <span className="text-[10px] bg-success/40 text-white px-1.5 py-0.5 rounded">
                          {feedTag}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {spindleValue ? (
                    <div
                      className={cn(
                        DARK_GLASS,
                        'px-3 py-2 rounded-lg font-mono text-xs flex items-center gap-3',
                      )}
                    >
                      <span className="text-white/60">{spindleLabel}</span>
                      <span className="font-bold text-sm">{spindleValue}</span>
                      {spindleTag ? (
                        <span className="text-[10px] text-white/70">{spindleTag}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {/* Safety status (top-right) */}
                {auditValue ? (
                  <div className="absolute top-4 end-4 z-20">
                    <div className={cn(DARK_GLASS, 'px-3.5 py-2 rounded-lg flex items-center gap-2')}>
                      <Icon name="verified_user" className="size-4 text-success" />
                      <div className="text-left">
                        <div className="text-[10px] text-success tracking-wider uppercase font-bold">
                          {auditTitle}
                        </div>
                        <div className="text-xs font-mono font-bold">{auditValue}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {/* Kinematic axis drawer (bottom) */}
                {axes.length > 0 ? (
                  <div className={cn(DARK_GLASS, 'absolute bottom-4 inset-x-4 p-3.5 rounded-xl z-20')}>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon name="tune" className="size-3.5 text-white/70 shrink-0" />
                        <span className="text-xs font-mono font-medium text-white/90 truncate">
                          {axesTitle}
                        </span>
                      </div>
                      {vibration ? (
                        <span className="text-[11px] font-mono text-success shrink-0 hidden sm:inline">
                          {vibration}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="grid gap-2 text-center font-mono"
                      style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}
                    >
                      {axes.map((axis, i) => (
                        <div
                          key={i}
                          className={cn(
                            'bg-white/10 p-1.5 rounded border',
                            axis.tone === 'accent' ? 'border-primary/50' : 'border-white/10',
                          )}
                        >
                          <span
                            className={cn(
                              'text-[10px] block',
                              axis.tone === 'accent' ? 'text-white' : 'text-white/60',
                            )}
                          >
                            {axis.label}
                          </span>
                          <span className="text-xs font-bold text-white">{axis.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {/* Mode selector bar */}
              {modes.length > 0 ? (
                <div className="p-2 flex items-center justify-between gap-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-2 flex-wrap">
                    {modes.map((mode, i) => (
                      <span
                        key={i}
                        className={cn(
                          'px-2.5 py-1 rounded font-medium transition',
                          i === 0
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-low text-text-primary hover:bg-surface-container-high',
                          i >= 2 ? 'hidden sm:inline-block' : undefined,
                        )}
                      >
                        {mode.label}
                      </span>
                    ))}
                  </div>
                  {controllerLabel ? (
                    <span className="text-[11px] text-text-muted hidden sm:inline-block shrink-0">
                      {controllerLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {/* Floating metric badge */}
            {floatValue ? (
              <div className="absolute -bottom-6 -start-6 liquid-glass p-4 rounded-xl shadow-xl hidden md:flex items-center gap-3 z-30">
                <div className="size-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <Icon name={floatIcon ?? 'speed'} className="size-5" />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium">{floatLabel}</div>
                  <div className="text-lg font-bold text-text-primary font-mono">
                    {floatValue}
                    {floatTag ? (
                      <span className="text-success text-xs font-sans font-semibold ms-1">
                        {floatTag}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
