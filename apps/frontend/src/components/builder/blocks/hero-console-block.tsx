'use client';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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
    consoleMode = 'auto',
  } = props;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const hasConsoleChildren = (puck.getSlotData?.('console')?.length ?? 0) > 0;
  const composed = consoleMode === 'composed' || (consoleMode === 'auto' && hasConsoleChildren);
  return (
    <section
      id={id}
      className={cn('relative overflow-hidden', className)}
      style={layoutStyle(props)}
    >
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left: value proposition column */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {puck.renderSlot('content')}
          </div>
          {/* Right: simulator console card */}
          {/* Reserve room under the console for the floating metric badge; without it the badge
              overlapped the mode selector and hid the view controls. */}
          <div className="lg:col-span-6 relative md:pb-16">
            {composed ? (
              puck.renderSlot('console')
            ) : (
              <>
                <div className="relative rounded-2xl p-2 liquid-glass shadow-xl" dir="ltr">
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
                    {imageUrl && !imageFailed ? (
                      <img
                        src={imageUrl}
                        alt={imageAlt}
                        loading="eager"
                        decoding="async"
                        onError={() => setImageFailed(true)}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : null}
                    {puck?.isEditing && (!imageUrl || imageFailed) ? (
                      <span className="absolute start-1/2 top-4 z-30 -translate-x-1/2 rounded bg-background/90 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
                        {imageFailed ? 'Image failed' : 'Add console image'}
                      </span>
                    ) : null}
                    {/* Telemetry badges (top-left). Capped on phones so they never run into
                        the audit card pinned to the opposite corner. */}
                    <div className="absolute top-4 start-4 z-20 flex max-w-[calc(50%-1.25rem)] flex-col gap-2 sm:max-w-none">
                      {feedValue ? (
                        <div
                          className={cn(
                            DARK_GLASS,
                            'flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg px-2.5 py-1.5 font-mono text-[10px] sm:gap-3 sm:px-3 sm:py-2 sm:text-xs',
                          )}
                        >
                          <span className="shrink-0 text-white/60">{feedLabel}</span>
                          <span className="text-xs font-bold sm:text-sm">{feedValue}</span>
                          {feedTag ? (
                            <span className="rounded bg-success/40 px-1.5 py-0.5 text-[9px] text-white sm:text-[10px]">
                              {feedTag}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {spindleValue ? (
                        <div
                          className={cn(
                            DARK_GLASS,
                            'flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg px-2.5 py-1.5 font-mono text-[10px] sm:gap-3 sm:px-3 sm:py-2 sm:text-xs',
                          )}
                        >
                          <span className="shrink-0 text-white/60">{spindleLabel}</span>
                          <span className="text-xs font-bold sm:text-sm">{spindleValue}</span>
                          {spindleTag ? (
                            <span className="text-[9px] text-white/70 sm:text-[10px]">
                              {spindleTag}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {/* Safety status (top-right) */}
                    {auditValue ? (
                      <div className="absolute top-4 end-4 z-20 max-w-[calc(50%-1.25rem)] sm:max-w-none">
                        <div
                          className={cn(
                            DARK_GLASS,
                            'flex min-w-0 max-w-full items-start gap-1.5 rounded-lg px-2.5 py-1.5 sm:items-center sm:gap-2 sm:px-3.5 sm:py-2',
                          )}
                        >
                          <Icon
                            name="verified_user"
                            className="mt-0.5 size-3.5 shrink-0 text-success sm:mt-0 sm:size-4"
                          />
                          <div className="min-w-0 text-left">
                            <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-success sm:text-[10px]">
                              {auditTitle}
                            </div>
                            <div className="break-words text-[10px] font-mono font-bold leading-tight sm:text-xs">
                              {auditValue}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {/* Kinematic axis drawer (bottom) */}
                    {axes.length > 0 ? (
                      <div
                        className={cn(
                          DARK_GLASS,
                          'absolute bottom-4 inset-x-4 rounded-xl p-2.5 z-20 sm:p-3.5',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon name="tune" className="size-3.5 text-white/70 shrink-0" />
                            <span className="text-[10px] font-mono font-medium text-white/90 truncate sm:text-xs">
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
                          className="grid grid-cols-3 gap-1.5 text-center font-mono sm:grid-cols-[repeat(var(--axis-count),minmax(0,1fr))] sm:gap-2"
                          style={{ '--axis-count': axes.length } as CSSProperties}
                        >
                          {axes.map((axis, i) => (
                            <div
                              key={i}
                              className={cn(
                                'rounded border bg-white/10 p-1 sm:p-1.5',
                                axis.tone === 'accent' ? 'border-primary/50' : 'border-white/10',
                              )}
                            >
                              <span
                                className={cn(
                                  'block text-[9px] sm:text-[10px]',
                                  axis.tone === 'accent' ? 'text-white' : 'text-white/60',
                                )}
                              >
                                {axis.label}
                              </span>
                              <span className="text-[11px] font-bold text-white sm:text-xs">
                                {axis.value}
                              </span>
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
                    <div dir="ltr">
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
