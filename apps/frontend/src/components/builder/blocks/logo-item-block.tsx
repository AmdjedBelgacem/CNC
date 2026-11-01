import type { LogoItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** A partner logo: image or icon + wordmark, with hover scale. */
export function LogoItemBlock({ props, puck }: BlockComponentProps<LogoItemProps>) {
  const { className } = props;
  return (
    <div
      className={cn(
        'group transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      {puck.renderSlot('content')}{' '}
    </div>
  );
}
