import type { TwinSectionProps } from '@titan/shared';
import { isNodeArray } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';
import { Reveal } from '@/components/ui/motion';

/** Code line tones inside the dark terminal (mockup syntax highlighting). */
const LINE_TONE: Record<string, string> = {
  comment: 'text-muted-foreground/70 italic',
  code: 'text-foreground/85',
  highlight:
    '-mx-2 rounded-md border-s-2 border-primary bg-primary/[0.07] px-2 py-1 font-medium text-primary',
  ok: 'pt-2 font-medium text-success',
};

/** Readout value tones in the control dashboard. */
const READOUT_TONE: Record<string, string> = {
  success: 'text-success',
  normal: 'text-foreground',
  accent: 'text-primary',
  primary: 'text-foreground',
};

/** Paper editor panel — a code view on ivory rather than a black terminal. */
const DARK_PANEL = 'bg-card border border-border/70 text-foreground';

/**
 * Digital twin section: left feature narrative (content + features slots)
 * beside a G-code terminal mockup with a syntax view and a readout dashboard.
 */
export function TwinSectionBlock({ props, puck }: BlockComponentProps<TwinSectionProps>) {
  const {
    id,
    className,
    sectionBg = '',
    fileName,
    statusLabel,
    codeLines = [],
    readouts = [],
  } = props;

  const slotCodeLines = puck.getSlotData?.('code') ?? [];
  const slotReadouts = puck.getSlotData?.('readoutCells') ?? [];
  const legacyCodeLines = Array.isArray(codeLines) && !isNodeArray(codeLines) ? codeLines : [];
  const legacyReadouts = Array.isArray(readouts) && !isNodeArray(readouts) ? readouts : [];

  return (
    <section
      id={id}
      className={cn('relative overflow-hidden', sectionBg, className)}
      style={layoutStyle(props)}
    >
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: narrative */}
          <div className="lg:col-span-5 flex flex-col">
            {puck.renderSlot('content')}
            <div className="space-y-6">{puck.renderSlot('features')}</div>
          </div>
          {/* Right: terminal */}
          <Reveal className="lg:col-span-7" delay={0.08}>
            <div
              className={cn(
                DARK_PANEL,
                'overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/[0.03] dark:ring-white/[0.04]',
              )}
            >
              {/* Terminal header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="inline-block size-2.5 rounded-full bg-destructive/45"></span>
                    <span className="inline-block size-2.5 rounded-full bg-warning/45"></span>
                    <span className="inline-block size-2.5 rounded-full bg-success/45"></span>
                  </div>
                  {fileName ? (
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{fileName}</span>
                  ) : null}
                </div>
                {statusLabel ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 font-mono text-2xs font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success animate-pulse"></span>
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              {/* Code view */}
              {slotCodeLines.length > 0 || legacyCodeLines.length > 0 || puck.isEditing ? (
                <div className="space-y-1 overflow-x-auto bg-card p-6 font-mono text-xs leading-relaxed sm:text-[13px]">
                  {slotCodeLines.length > 0
                    ? puck.renderSlot('code')
                    : legacyCodeLines.map((line, index) => (
                        <div key={index} className={LINE_TONE[line.tone ?? 'code']}>
                          {line.text}
                        </div>
                      ))}
                </div>
              ) : null}
              {/* Control dashboard */}
              {slotReadouts.length > 0 || legacyReadouts.length > 0 || puck.isEditing ? (
                <div className="grid grid-cols-2 gap-3 border-t border-border/70 bg-muted/40 p-4 text-center font-mono sm:grid-cols-4">
                  {slotReadouts.length > 0
                    ? puck.renderSlot('readoutCells')
                    : legacyReadouts.map((cell, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border/70 bg-card p-2.5 shadow-xs"
                        >
                          <span className="block font-sans text-[11px] text-muted-foreground">
                            {cell.label}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 block text-xs font-semibold tabular-nums',
                              READOUT_TONE[cell.tone ?? 'normal'],
                            )}
                          >
                            {cell.value}
                          </span>
                        </div>
                      ))}
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
