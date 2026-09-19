import Link from 'next/link';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DifficultyBar } from './difficulty-bar';
import { cn } from '@/lib/utils';
interface CourseCardProps {
  slug: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  difficulty: number;
  estimatedHours?: number | null;
  progress?: number;
}
export function CourseCard({
  slug,
  title,
  subtitle,
  thumbnailUrl,
  difficulty,
  estimatedHours,
  progress,
}: CourseCardProps) {
  return (
    <Link href={`/courses/${slug}`}>
      {' '}
      <Card
        className={cn(
          'group overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
          'h-full flex flex-col',
        )}
      >
        {' '}
        <div className="aspect-video bg-muted overflow-hidden">
          {' '}
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {' '}
              <span className="text-4xl font-bold opacity-20">{title[0]}</span>{' '}
            </div>
          )}{' '}
        </div>{' '}
        <CardHeader className="flex-1">
          {' '}
          <CardTitle className="text-lg">{title}</CardTitle>{' '}
          {subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2">{subtitle}</p>
          )}{' '}
        </CardHeader>{' '}
        <CardFooter className="flex-col items-start gap-2">
          {' '}
          <DifficultyBar level={difficulty} size="sm" />{' '}
          {estimatedHours && (
            <span className="text-xs text-muted-foreground">{estimatedHours}h estimated</span>
          )}{' '}
          {progress !== undefined && (
            <div className="w-full">
              {' '}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                {' '}
                <span>Progress</span> <span>{progress}%</span>{' '}
              </div>{' '}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                {' '}
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />{' '}
              </div>{' '}
            </div>
          )}{' '}
        </CardFooter>{' '}
      </Card>{' '}
    </Link>
  );
}
