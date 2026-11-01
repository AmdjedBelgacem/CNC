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
        'rounded-full px-3 py-1 font-medium transition-colors duration-200',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        hideOnMobile && 'hidden sm:inline-block',
        className,
      )}
      style={layoutStyle(props)}
    >
      {label}
    </span>
  );
}
