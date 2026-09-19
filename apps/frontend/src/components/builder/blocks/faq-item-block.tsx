'use client';
import { useState } from 'react';
import type { FaqItemProps } from '@titan/shared';
import { resolveIconName } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** FAQ card: question row toggles the answer panel open/closed. */
export function FaqItemBlock({ props, puck }: BlockComponentProps<FaqItemProps>) {
  const [open, setOpen] = useState(false);
  const {
    className,
    buttonPaddingX = 'px-8',
    buttonPaddingY = 'py-6',
    answerPaddingX = 'px-8',
    answerPaddingBottom = 'pb-6',
    icon = 'add',
  } = props;
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-2xl overflow-hidden border border-gray-200 transition-all duration-300 hover:shadow-lg group',
        className,
      )}
      style={layoutStyle(props)}
    >
      {' '}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between text-left cursor-pointer',
          buttonPaddingX,
          buttonPaddingY,
        )}
      >
        {' '}
        <span>{puck.renderSlot('toggle')}</span>{' '}
        <span
          className={cn(
            'material-symbols-outlined text-primary transition-transform duration-300',
            open && 'rotate-45',
          )}
          aria-hidden="true"
        >
          {' '}
          {resolveIconName(icon)}{' '}
        </span>{' '}
      </button>{' '}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {' '}
        <div className="overflow-hidden min-h-0">
          {' '}
          <div className={cn(answerPaddingX, answerPaddingBottom)}>
            {puck.renderSlot('content')}
          </div>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
