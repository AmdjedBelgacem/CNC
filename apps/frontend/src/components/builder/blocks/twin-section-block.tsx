import type { TwinSectionProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** Code line tones inside the dark terminal (mockup syntax highlighting). */
const LINE_TONE: Record<string, string> = {
  comment: 'text-white/40',
  code: 'text-white/80',
  highlight: 'text-success bg-primary/20 px-2 py-1 rounded border-s-2 border-primary font-semibold',
  ok: 'text-success font-semibold pt-2',
};

/** Readout value tones in the control dashboard. */
const READOUT_TONE: Record<string, string> = {
  success: 'text-success',
  normal: 'text-white',
  accent: 'text-secondary-fixed',
  primary: 'text-white',
};

const DARK_PANEL = 'bg-overlay/90 backdrop-blur-md border border-white/10 text-white';

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
  return (
    <section
      id={id}
      className={cn('relative overflow-hidden', sectionBg, className)}
      style={layoutStyle(props)}
    >
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: narrative */}
          <div className="lg:col-span-5 flex flex-col">
            {puck.renderSlot('content')}
            <div className="space-y-6">{puck.renderSlot('features')}</div>
          </div>
          {/* Right: terminal */}
          <div className="lg:col-span-7">
            <div className={cn(DARK_PANEL, 'rounded-2xl overflow-hidden shadow-2xl')}>
              {/* Terminal header */}
              <div className="bg-black/40 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="size-3 rounded-full bg-destructive inline-block"></span>
                    <span className="size-3 rounded-full bg-warning inline-block"></span>
                    <span className="size-3 rounded-full bg-success inline-block"></span>
                  </div>
                  {fileName ? (
                    <span className="text-xs font-mono text-white/80 truncate">{fileName}</span>
                  ) : null}
                </div>
                {statusLabel ? (
                  <span className="text-xs text-success font-mono flex items-center gap-1 shrink-0">
                    <span className="size-2 rounded-full bg-success animate-pulse"></span>
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              {/* Code view */}
              {codeLines.length > 0 ? (
                <div className="p-6 font-mono text-xs sm:text-sm leading-relaxed bg-black/60 overflow-x-auto space-y-1">
                  {codeLines.map((line, i) => (
                    <div key={i} className={LINE_TONE[line.tone ?? 'code']}>
                      {line.text}
                    </div>
                  ))}
                </div>
              ) : null}
              {/* Control dashboard */}
              {readouts.length > 0 ? (
                <div className="bg-black/80 p-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                  {readouts.map((cell, i) => (
                    <div key={i} className="p-2 rounded bg-white/5 border border-white/10">
                      <span className="text-[10px] text-white/50 block">{cell.label}</span>
                      <span
                        className={cn(
                          'text-xs font-bold',
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
          </div>
        </div>
      </div>
    </section>
  );
}
