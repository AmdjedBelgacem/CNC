'use client';
import { useState } from 'react';
import type { FaqItemProps } from '@titan/shared';
import { cn } from '@/lib/utils';
import { layoutStyle } from '@/components/builder/layout-style';
import type { BlockComponentProps } from './index'; /** FAQ card: question row toggles the answer panel open/closed. */
import { Icon } from '@/components/ui/icon';
import { m } from 'framer-motion';
import { spring } from '@/lib/motion';
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
        'group overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300',
        open ? 'border-border shadow-md' : 'border-border/70 shadow-xs hover:border-border-strong hover:shadow-sm',
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
          'flex w-full cursor-pointer items-center justify-between gap-6 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40',
          buttonPaddingX,
          buttonPaddingY,
        )}
      >
        {' '}
        <span>{puck.renderSlot('toggle')}</span>{' '}
        <m.span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
            open ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground',
          )}
          animate={{ rotate: open ? 45 : 0 }}
          transition={spring.snappy}
        >
          <Icon name={icon} className="size-4" />
        </m.span>{' '}
      </button>{' '}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
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
