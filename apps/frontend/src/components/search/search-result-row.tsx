'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  Layers,
  PlayCircle,
  Search,
  ShoppingBag,
  User,
} from 'lucide-react';
import type { SearchResultItem, SearchResultType } from '@/hooks/use-search';
import { cn } from '@/lib/utils';

export const SEARCH_TYPE_ICON: Record<SearchResultType, typeof BookOpen> = {
  course: BookOpen,
  series: Layers,
  lesson: PlayCircle,
  product: ShoppingBag,
  event: Calendar,
  post: FileText,
  user: User,
  academy: GraduationCap,
  page: FileText,
  order: ShoppingBag,
  certificate: Award,
};

const TYPE_TONE: Record<SearchResultType, string> = {
  course: 'bg-primary/10 text-primary',
  series: 'bg-accent/10 text-accent',
  lesson: 'bg-muted text-muted-foreground',
  product: 'bg-warning/10 text-warning',
  event: 'bg-success/10 text-success',
  post: 'bg-muted text-muted-foreground',
  user: 'bg-primary/10 text-primary',
  academy: 'bg-accent/10 text-accent',
  page: 'bg-muted text-muted-foreground',
  order: 'bg-warning/10 text-warning',
  certificate: 'bg-success/10 text-success',
};

export function SearchTypeIcon({ type, className }: { type: SearchResultType; className?: string }) {
  const Icon = SEARCH_TYPE_ICON[type] ?? Search;
  return <Icon className={cn('size-4', className)} />;
}

export function SearchResultRow({
  item,
  active,
  showType = true,
  option,
  onMouseEnter,
  onNavigate,
  className,
  id,
}: {
  item: SearchResultItem;
  active?: boolean;
  showType?: boolean;
  option?: boolean;
  onMouseEnter?: () => void;
  onNavigate?: () => void;
  className?: string;
  id?: string;
}) {
  const Icon = SEARCH_TYPE_ICON[item.type] ?? Search;
  return (
    <Link
      id={id}
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={onMouseEnter}
      role={option ? 'option' : undefined}
      aria-selected={option ? active : undefined}
      tabIndex={option ? -1 : undefined}
      className={cn(
        'group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-start transition-all',
        active ? 'bg-primary/10 ring-1 ring-inset ring-primary/15' : 'hover:bg-muted/70',
        className,
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TYPE_TONE[item.type])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
          {active && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle || item.href}</span>
      </span>
      {showType && (
        <span className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">
          {item.type}
        </span>
      )}
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/60 transition group-hover:text-primary" />
    </Link>
  );
}
