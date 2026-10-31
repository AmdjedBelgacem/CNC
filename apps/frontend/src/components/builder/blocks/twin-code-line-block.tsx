import type { TwinCodeLineProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

const LINE_TONE: Record<string, string> = {
  comment: 'text-muted-foreground/70 italic',
  code: 'text-foreground/85',
  highlight:
    '-mx-2 rounded-md border-s-2 border-primary bg-primary/[0.07] px-2 py-1 font-medium text-primary',
  ok: 'pt-2 font-medium text-success',
};

/** One syntax-highlighted line in the digital-twin terminal. */
export function TwinCodeLineBlock({ props }: BlockComponentProps<TwinCodeLineProps>) {
  const { text, tone = 'code', className } = props;
  return (
    <div className={cn(LINE_TONE[tone] ?? LINE_TONE.code, className)} style={layoutStyle(props)}>
      {text}
    </div>
  );
}
