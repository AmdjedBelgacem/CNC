import { cn } from '@/lib/utils';

const labels: Record<number, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
  5: 'Master',
};

// Semantic token ramp: easy levels read as "go", mid as caution, top as danger.
const fills = ['bg-success', 'bg-success', 'bg-warning', 'bg-warning', 'bg-destructive'];

interface DifficultyBarProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function DifficultyBar({ level, size = 'md', showLabel = true }: DifficultyBarProps) {
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };
  const clamped = Math.min(5, Math.max(1, level));
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn('flex flex-1 gap-0.5', heights[size])}
        role="meter"
        aria-valuenow={level}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-label={`Difficulty: ${labels[clamped]}`}
      >
        {[1, 2, 3, 4, 5].map((segment) => (
          <div
            key={segment}
            className={cn(
              'flex-1 rounded-sm transition-colors duration-150',
              segment <= level ? fills[clamped - 1] : 'bg-muted',
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          {labels[clamped]}
        </span>
      )}
    </div>
  );
}
