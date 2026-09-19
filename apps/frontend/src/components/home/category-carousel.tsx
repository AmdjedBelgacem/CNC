'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Wrench,
  Monitor,
  Book,
  Ruler,
  Package,
  Cpu,
  Disc,
} from 'lucide-react';
const categories = [
  { label: 'CNC Machines', icon: Wrench, slug: 'cnc-machines' },
  { label: 'CAM Software', icon: Monitor, slug: 'cam-software' },
  { label: 'Workholding', icon: Wrench, slug: 'workholding' },
  { label: 'End Mills', icon: Disc, slug: 'end-mills' },
  { label: 'Shell Mills', icon: Disc, slug: 'shell-mills' },
  { label: 'Milling Inserts', icon: Disc, slug: 'milling-inserts' },
  { label: 'Tool Holders', icon: Wrench, slug: 'tool-holders' },
  { label: 'Drills', icon: Disc, slug: 'drills' },
  { label: 'Indexable Drills', icon: Disc, slug: 'indexable-drills' },
  { label: 'Turning Inserts', icon: Disc, slug: 'turning-inserts' },
  { label: 'Tool Kits', icon: Package, slug: 'tool-kits' },
  { label: 'Computers', icon: Cpu, slug: 'computers' },
  { label: 'Grinding Wheels', icon: Disc, slug: 'grinding-wheels' },
  { label: 'Inspection', icon: Ruler, slug: 'inspection' },
  { label: 'Shop Utilities', icon: Package, slug: 'shop-utilities' },
  { label: 'Merchandise', icon: Book, slug: 'merchandise' },
];
export function CategoryCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };
  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    return () => el.removeEventListener('scroll', updateScrollState);
  }, []);
  return (
    <section className="py-24 bg-secondary/20">
      {' '}
      <div className="container mx-auto px-4">
        {' '}
        <div className="flex items-center justify-between mb-8">
          {' '}
          <div>
            {' '}
            <h2 className="text-3xl font-bold">Build Your CNC Shop</h2>{' '}
            <p className="text-muted-foreground mt-1">
              Everything you need, from machines to end mills.
            </p>{' '}
          </div>{' '}
          <div className="flex gap-2">
            {' '}
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="flex items-center justify-center rounded-full border bg-card p-2.5 min-w-[44px] min-h-[44px] disabled:opacity-30 hover:border-primary/50 transition-colors"
              aria-label="Scroll left"
            >
              {' '}
              <ChevronLeft className="h-5 w-5" />{' '}
            </button>{' '}
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="flex items-center justify-center rounded-full border bg-card p-2.5 min-w-[44px] min-h-[44px] disabled:opacity-30 hover:border-primary/50 transition-colors"
              aria-label="Scroll right"
            >
              {' '}
              <ChevronRight className="h-5 w-5" />{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4"
        >
          {' '}
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.label}`}
              className="snap-start shrink-0 w-36 rounded-xl border bg-card p-5 text-center hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group min-h-[44px]"
            >
              {' '}
              <cat.icon
                className="h-8 w-8 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors"
                aria-hidden="true"
              />{' '}
              <span className="text-sm font-medium leading-tight">{cat.label}</span>{' '}
            </Link>
          ))}{' '}
        </div>{' '}
      </div>{' '}
    </section>
  );
}
