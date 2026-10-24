import type { ConsoleAxisProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** One axis label / value cell. */
export function ConsoleAxisBlock({ props, puck }: BlockComponentProps<ConsoleAxisProps>) {
  const { label, value, tone = 'normal', className } = props;
  if (!value && !puck?.isEditing) return null;
  const accent = tone === 'accent';
  return (
    <div
      className={cn(
        'flex-1 min-w-0 bg-white/10 p-1.5 rounded border',
        accent ? 'border-primary/50' : 'border-white/10',
        className,
      )}
      style={layoutStyle(props)}
    >
      <span className={cn('text-[10px] block truncate', accent ? 'text-white' : 'text-white/60')}>
        {label}
      </span>
      <span className="text-xs font-bold text-white block truncate">{value || '0.000'}</span>
    </div>
  );
}
