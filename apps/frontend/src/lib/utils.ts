import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge'; /** * Custom font-size tokens from globals.css @theme. tailwind-merge cannot tell * these from text-colour utilities, so without this list `text-headline-lg` * gets dropped whenever a `text-*` colour follows it in the class list. */
const twMergeWithTheme = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display-hero',
        'text-display-hero-mobile',
        'text-headline-lg',
        'text-headline-md',
        'text-label-sm',
        'text-body-lg',
        'text-body-md',
        'text-stats-number',
      ],
    },
  },
});
export function cn(...inputs: ClassValue[]) {
  return twMergeWithTheme(clsx(inputs));
}
export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}
export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : plural || `${singular}s`;
}
