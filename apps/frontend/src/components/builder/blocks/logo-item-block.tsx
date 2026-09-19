import type { LogoItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** A partner logo: image or icon + wordmark, with hover scale. */
export function LogoItemBlock({ props, puck }: BlockComponentProps<LogoItemProps>) {
  const { className } = props;
  return (
    <div
      className={cn('group transition-all duration-300 hover:scale-110', className)}
      style={layoutStyle(props)}
    >
      {' '}
      {puck.renderSlot('content')}{' '}
    </div>
  );
}
