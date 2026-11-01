'use client';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { HeroConsoleProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Icon } from '@/components/ui/icon';
import { ConsoleFloat } from './console-motion';

/** Paper-glass telemetry panel treatment (console mockup overlays). */
const DARK_GLASS = 'bg-card/85 backdrop-blur-md border border-border/70 shadow-sm text-foreground';

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
      {/* Warm ambient wash + a whisper-faint dot field behind the hero. */}
      <div className="pointer-events-none absolute inset-0 ambient-wash" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 blueprint-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        aria-hidden
      />
      <div className="relative px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-10 items-center">
          {/* Left: value proposition column */}
          {/* `maxWidth` on a builder text block also centres it (margin-inline:
              auto). In this start-aligned column that read as a stray indent,
              so copy is anchored back to the column's start edge. */}
          <div className="lg:col-span-6 flex flex-col items-start text-start [&_p]:!ms-0 [&_p]:!me-0">
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
                <div className="relative rounded-2xl p-2 ring-1 ring-black/[0.03] dark:ring-white/[0.04] motion-safe:animate-fade-in-up motion-safe:[animation-delay:120ms] motion-safe:[animation-duration:900ms] motion-safe:[animation-fill-mode:both] liquid-glass shadow-xl" dir="ltr">
                  {/* Console header bar */}
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-card px-3.5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex gap-1.5 shrink-0">
                        <span className="size-2.5 rounded-full bg-destructive/45"></span>
                        <span className="size-2.5 rounded-full bg-warning/45"></span>
                        <span className="size-2.5 rounded-full bg-success/45"></span>
                      </div>
                      {fileName ? (
                        <span className="ms-2 truncate font-mono text-[11px] text-muted-foreground">
                          {fileName}
                        </span>
                      ) : null}
                    </div>
                    {syncLabel ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 font-mono text-2xs font-medium text-success">
                        <span className="size-1.5 rounded-full bg-success animate-pulse"></span>
                        {syncLabel}
                      </span>
                    ) : null}
                  </div>
                  {/* Viewport */}
                  <div className="relative h-[380px] sm:h-[440px] overflow-hidden rounded-xl bg-surface-sunken ring-1 ring-inset ring-border/60 group">
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
                      <span className="absolute start-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
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
                          <span className="shrink-0 text-muted-foreground">{feedLabel}</span>
                          <span className="text-xs font-semibold tabular-nums sm:text-sm">{feedValue}</span>
                          {feedTag ? (
                            <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success sm:text-[10px]">
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
                          <span className="shrink-0 text-muted-foreground">{spindleLabel}</span>
                          <span className="text-xs font-semibold tabular-nums sm:text-sm">{spindleValue}</span>
                          {spindleTag ? (
                            <span className="text-[9px] text-muted-foreground sm:text-[10px]">
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
                            <div className="text-[10px] font-medium leading-tight text-success sm:text-[11px]">
                              {auditTitle}
                            </div>
                            <div className="break-words text-[10px] font-mono font-semibold leading-tight tabular-nums sm:text-xs">
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
                          'absolute bottom-4 inset-x-4 z-20 rounded-2xl p-2.5 sm:p-3.5',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon name="tune" className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-medium text-foreground/90 truncate sm:text-xs">
                              {axesTitle}
                            </span>
                          </div>
                          {vibration ? (
                            <span className="text-[11px] font-mono text-success/90 shrink-0 hidden sm:inline">
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
                                'rounded-md border bg-background/70 p-1 sm:p-1.5',
                                axis.tone === 'accent' ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70',
                              )}
                            >
                              <span
                                className={cn(
                                  'block text-[9px] sm:text-[10px]',
                                  axis.tone === 'accent' ? 'text-primary' : 'text-muted-foreground',
                                )}
                              >
                                {axis.label}
                              </span>
                              <span className="text-[11px] font-semibold text-foreground tabular-nums sm:text-xs">
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
                    <div className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        {modes.map((mode, i) => (
                          <span
                            key={i}
                            className={cn(
                              'rounded-full px-3 py-1 font-medium transition-colors duration-200',
                              i === 0
                                ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                              i >= 2 ? 'hidden sm:inline-block' : undefined,
                            )}
                          >
                            {mode.label}
                          </span>
                        ))}
                      </div>
                      {controllerLabel ? (
                        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline-block">
                          {controllerLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {/* Floating metric badge */}
                {floatValue ? (
                  <div className="absolute -bottom-6 -start-6 z-30 hidden md:block">
                    <ConsoleFloat
                      delay={0.6}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-3.5 pe-5 shadow-lg backdrop-blur-md"
                    >
                      <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
                        <Icon name={floatIcon ?? 'speed'} className="size-5" />
                      </div>
                      <div dir="ltr">
                        <div className="text-xs font-medium text-muted-foreground">{floatLabel}</div>
                        <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
                          {floatValue}
                          {floatTag ? (
                            <span className="ms-1.5 font-sans text-xs font-medium text-success">
                              {floatTag}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </ConsoleFloat>
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
