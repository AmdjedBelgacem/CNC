/** Shared visual tokens for the composable simulator console. */
export const CONSOLE_DARK_GLASS =
  'bg-overlay/85 backdrop-blur-md border border-white/10 shadow-lg text-white';

export const CONSOLE_RADIUS: Record<string, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
};

export const CONSOLE_CORNER: Record<string, string> = {
  'top-left': 'top-4 start-4',
  'top-right': 'top-4 end-4',
  'bottom-left': 'bottom-4 start-4',
  'bottom-right': 'bottom-4 end-4',
};

export const CONSOLE_METRIC_POSITION: Record<string, string> = {
  'top-left': 'bottom-full mb-4 -start-6',
  'top-right': 'bottom-full mb-4 -end-6',
  'bottom-left': 'top-full mt-4 -start-6',
  'bottom-right': 'top-full mt-4 -end-6',
};
