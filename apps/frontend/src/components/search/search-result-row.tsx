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
import { m } from 'framer-motion';
import type { SearchResultItem, SearchResultType } from '@/hooks/use-search';
import { spring } from '@/lib/motion';
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
  activeLayoutId,
}: {
  item: SearchResultItem;
  active?: boolean;
  showType?: boolean;
  option?: boolean;
  onMouseEnter?: () => void;
  onNavigate?: () => void;
  className?: string;
  id?: string;
  /**
   * When set, the active highlight is a shared-layout element that glides between
   * rows (command palette keyboard navigation) instead of snapping.
   */
  activeLayoutId?: string;
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
        'group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? activeLayoutId
            ? ''
            : 'bg-muted/80'
          : activeLayoutId
            ? ''
            : 'hover:bg-muted/60',
        className,
      )}
    >
      {active && activeLayoutId && (
        <m.span
          layoutId={activeLayoutId}
          aria-hidden
          className="absolute inset-0 rounded-xl bg-muted ring-1 ring-inset ring-border/70"
          transition={spring.snappy}
        />
      )}
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-primary"
        />
      )}
      <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105', TYPE_TONE[item.type])}>
        <Icon className="size-4" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle || item.href}</span>
      </span>
      {showType && (
        <span className="relative hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground sm:inline-flex">
          {item.type}
        </span>
      )}
      <ArrowUpRight
        className={cn(
          'relative size-3.5 shrink-0 transition-all duration-200 rtl:-scale-x-100',
          active
            ? 'translate-x-0 text-primary opacity-100'
            : 'text-muted-foreground/60 group-hover:text-primary',
        )}
      />
    </Link>
  );
}
