import { cn } from '@/lib/utils';
const labels: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
  5: 'Master',
};
const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
interface DifficultyBarProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
export function DifficultyBar({ level, size = 'md', showLabel = true }: DifficultyBarProps) {
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };
  return (
    <div className="flex items-center gap-2">
      {' '}
      <div
        className={cn('flex gap-0.5 flex-1', heights[size])}
        role="meter"
        aria-valuenow={level}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label={`Difficulty: ${labels[level]}`}
      >
        {' '}
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            className={cn(
              'flex-1 rounded-sm transition-colors',
              segment <= level ? '' : 'bg-muted',
            )}
            style={segment <= level ? { backgroundColor: colors[level - 1] } : undefined}
          />
        ))}{' '}
      </div>{' '}
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {' '}
          {labels[level]}{' '}
        </span>
      )}{' '}
    </div>
  );
}
