'use client';
import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Globe, GlobeLock, Trash2 } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';

/* Shared by the product card and the table row so both views expose the same
 * actions and keyboard behaviour. */

export type ProductAction = 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete';

export interface ProductMenuTarget {
  slug: string;
  title: string;
  isPublished: boolean;
  isArchived: boolean;
}

export function ProductRowMenu({
  product,
  onAction,
  labels,
}: {
  product: ProductMenuTarget;
  onAction: (slug: string, action: ProductAction) => void;
  labels: {
    publish: string;
    unpublish: string;
    archive: string;
    restore: string;
    delete: string;
    menu: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Close on outside click and Escape; a menu that traps neither cannot be
    // dismissed from the keyboard.
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const st = product.isArchived ? 'archived' : product.isPublished ? 'published' : 'draft';

  const items: { key: ProductAction; label: string; icon: typeof Globe; danger?: boolean }[] = [];
  if (st === 'draft') items.push({ key: 'publish', label: labels.publish, icon: Globe });
  if (st === 'published') items.push({ key: 'unpublish', label: labels.unpublish, icon: GlobeLock });
  // An archived product can only be restored; anything else can be archived.
  if (st === 'archived') {
    items.push({ key: 'restore', label: labels.restore, icon: ArchiveRestore });
  } else {
    items.push({ key: 'archive', label: labels.archive, icon: Archive, danger: true });
  }
  items.push({ key: 'delete', label: labels.delete, icon: Trash2, danger: true });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={labels.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-lg border border-border/70 bg-card p-1.5 text-muted-foreground shadow-xs transition hover:border-border-strong hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      <AnimatePresence>
      {open && (
        <m.div
          role="menu"
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snappy }}
          exit={{ opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.12, ease: ease.exit } }}
          className="absolute end-0 z-30 mt-1.5 w-48 origin-top-right overflow-hidden rounded-xl border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg rtl:origin-top-left"
        >
          {items.map(({ key, label, icon: Icon, danger }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onAction(product.slug, key);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors',
                danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="size-4 shrink-0 opacity-70" />
              {label}
            </button>
          ))}
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
}
