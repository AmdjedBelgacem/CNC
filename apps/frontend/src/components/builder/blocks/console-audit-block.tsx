import type { ConsoleAuditProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import { Icon } from '@/components/ui/icon';
import type { BlockComponentProps } from './index';
import { CONSOLE_CORNER, CONSOLE_DARK_GLASS } from './console-shared';

/** Safety / collision-audit status card. */
export function ConsoleAuditBlock({ props, puck }: BlockComponentProps<ConsoleAuditProps>) {
  const { title, value, icon = 'verified_user', placement = 'top-right', className } = props;
  if (!value && !puck?.isEditing) return null;

  return (
    <div
      className={cn(
        // Half the screen on phones keeps this card out of the telemetry stack's lane;
        // its copy wraps instead of pushing the card across the feed badge.
        'absolute z-20 max-w-[calc(50%-1.25rem)] !pointer-events-auto sm:max-w-none',
        CONSOLE_CORNER[placement] ?? CONSOLE_CORNER['top-right'],
        className,
      )}
      style={layoutStyle(props)}
    >
      <div
        className={cn(
          CONSOLE_DARK_GLASS,
          'flex min-w-0 max-w-full items-start gap-1.5 rounded-lg px-2.5 py-1.5 sm:items-center sm:gap-2 sm:px-3.5 sm:py-2',
        )}
      >
        <Icon
          name={icon}
          className="mt-0.5 size-3.5 shrink-0 text-success sm:mt-0 sm:size-4"
        />
        <div className="min-w-0 text-left">
          <div className="text-[9px] font-bold uppercase leading-tight tracking-wider text-success sm:text-[10px]">
            {title}
          </div>
          <div className="break-words text-[10px] font-mono font-bold leading-tight sm:text-xs">
            {value || 'Value'}
          </div>
        </div>
      </div>
    </div>
  );
}
