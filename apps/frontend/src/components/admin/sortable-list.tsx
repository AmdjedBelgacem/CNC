'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { m, useDragControls, type DragControls, type HTMLMotionProps } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';

/* -----------------------------------------------------------------------------
 * SortableList — drag-to-reorder for admin editors.
 *
 * Framer Motion's `Reorder` components render the full `motion` component, which
 * `LazyMotion strict` rejects. This is the same idea built from `m`: items carry
 * `layout`, so siblings glide aside while one is dragged by its handle, and the
 * order is committed through `onMove` as the pointer crosses a neighbour.
 *
 * The handle is also a keyboard control: focus it and press ArrowUp / ArrowDown
 * (Home / End jump to the ends). Screens keep visible move buttons as well, so a
 * touch user is never forced to drag.
 * --------------------------------------------------------------------------- */

interface ListContext {
  keys: string[];
  onMove: (from: number, to: number) => void;
  listRef: RefObject<HTMLUListElement | null>;
  els: RefObject<Map<string, HTMLLIElement>>;
}

interface ItemContext {
  index: number;
  count: number;
  dragging: boolean;
  controls: DragControls;
  moveBy: (delta: number) => void;
  moveTo: (index: number) => void;
}

const ListCtx = createContext<ListContext | null>(null);
const ItemCtx = createContext<ItemContext | null>(null);

/** Index, bounds and drag state of the enclosing `SortableItem`. */
export function useSortableItem() {
  const ctx = useContext(ItemCtx);
  if (!ctx) throw new Error('useSortableItem must be used inside <SortableItem>');
  return ctx;
}

export function SortableList({
  keys,
  onMove,
  children,
  className,
  ...rest
}: {
  keys: string[];
  /** Move the item at `from` so it ends up at `to`. */
  onMove: (from: number, to: number) => void;
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<'ul'>, 'children' | 'className' | 'onDrag'>) {
  const listRef = useRef<HTMLUListElement>(null);
  const els = useRef(new Map<string, HTMLLIElement>());
  const value = useMemo(() => ({ keys, onMove, listRef, els }), [keys, onMove]);
  return (
    <ListCtx.Provider value={value}>
      <m.ul ref={listRef} className={cn('relative', className)} {...rest}>
        {children}
      </m.ul>
    </ListCtx.Provider>
  );
}

export function SortableItem({
  id,
  children,
  className,
  ...rest
}: {
  id: string;
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<'li'>, 'children' | 'className' | 'drag' | 'layout' | 'id'>) {
  const list = useContext(ListCtx);
  if (!list) throw new Error('SortableItem must be used inside <SortableList>');
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const index = list.keys.indexOf(id);
  const { els, listRef, onMove, keys } = list;

  const setRef = useCallback(
    (el: HTMLLIElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [els, id],
  );

  const moveTo = useCallback(
    (to: number) => {
      const clamped = Math.max(0, Math.min(keys.length - 1, to));
      if (clamped !== index && index >= 0) onMove(index, clamped);
    },
    [index, keys.length, onMove],
  );
  const moveBy = useCallback((delta: number) => moveTo(index + delta), [index, moveTo]);

  const ctx = useMemo(
    () => ({ index, count: keys.length, dragging, controls, moveBy, moveTo }),
    [index, keys.length, dragging, controls, moveBy, moveTo],
  );

  return (
    <ItemCtx.Provider value={ctx}>
      <m.li
        ref={setRef}
        layout="position"
        transition={spring.layout}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragSnapToOrigin
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        onDrag={(_, info) => {
          const ul = listRef.current;
          if (!ul || index < 0) return;
          const pointerY = info.point.y - (ul.getBoundingClientRect().top + window.scrollY);
          // Untransformed layout centres of every other row, so a row that is
          // mid-animation does not make the target flicker.
          let target = 0;
          for (const key of keys) {
            if (key === id) continue;
            const el = els.current.get(key);
            if (!el) continue;
            if (el.offsetTop + el.offsetHeight / 2 < pointerY) target += 1;
          }
          if (target !== index) onMove(index, target);
        }}
        style={{ zIndex: dragging ? 30 : undefined, position: 'relative' }}
        className={className}
        {...rest}
      >
        {children}
      </m.li>
    </ItemCtx.Provider>
  );
}

/** The grip. Pointer-drag starts the reorder; arrow keys move the item one step. */
export function DragHandle({ label, className }: { label: string; className?: string }) {
  const { controls, moveBy, moveTo, dragging, index, count } = useSortableItem();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') moveBy(-1);
    else if (event.key === 'ArrowDown') moveBy(1);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(count - 1);
    else return;
    event.preventDefault();
  };
  return (
    <button
      type="button"
      aria-label={label}
      aria-roledescription="sortable"
      aria-valuenow={index + 1}
      title={label}
      onPointerDown={(event) => controls.start(event)}
      onKeyDown={onKeyDown}
      style={{ touchAction: 'none' }}
      className={cn(
        'flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'cursor-grabbing bg-muted text-foreground',
        className,
      )}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

/** Immutable array move, shared by the editors that use `SortableList`. */
export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
