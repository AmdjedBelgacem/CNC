import type { ConsoleModeProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index';

/** One view-mode button. */
export function ConsoleModeBlock({ props }: BlockComponentProps<ConsoleModeProps>) {
  const { label, active = false, hideOnMobile = false, className } = props;
  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded font-medium transition',
        active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container-low text-text-primary hover:bg-surface-container-high',
        hideOnMobile && 'hidden sm:inline-block',
        className,
      )}
      style={layoutStyle(props)}
    >
      {label}
    </span>
  );
}
