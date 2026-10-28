import type { TwinCodeLineProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

const LINE_TONE: Record<string, string> = {
  comment: 'text-white/40',
  code: 'text-white/80',
  highlight: 'text-success bg-primary/20 px-2 py-1 rounded border-s-2 border-primary font-semibold',
  ok: 'text-success font-semibold pt-2',
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
