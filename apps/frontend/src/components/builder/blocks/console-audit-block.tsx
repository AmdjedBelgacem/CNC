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
        'absolute z-20 !pointer-events-auto',
        CONSOLE_CORNER[placement] ?? CONSOLE_CORNER['top-right'],
        className,
      )}
      style={layoutStyle(props)}
    >
      <div className={cn(CONSOLE_DARK_GLASS, 'px-3.5 py-2 rounded-lg flex items-center gap-2')}>
        <Icon name={icon} className="size-4 text-success" />
        <div className="text-left">
          <div className="text-[10px] text-success tracking-wider uppercase font-bold">{title}</div>
          <div className="text-xs font-mono font-bold">{value || 'Value'}</div>
        </div>
      </div>
    </div>
  );
}
