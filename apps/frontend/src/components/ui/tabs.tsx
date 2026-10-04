'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [values, setValues] = React.useState<string[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // One MutationObserver covers tabs being added, removed or reordered; a
  // click listener covers activation. Both are passive and cheap, and the list
  // is a handful of nodes at most.
  React.useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const read = () => {
      const triggers = Array.from(
        node.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      );
      setValues(triggers.map((t) => t.getAttribute('data-value') ?? t.value ?? ''));
      setActiveId(
        triggers.find((t) => t.getAttribute('aria-selected') === 'true')?.getAttribute('data-value') ?? null,
      );
    };

    read();
    const mo = new MutationObserver(read);
    mo.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected'] });
    return () => mo.disconnect();
  }, []);

  const ctx = React.useMemo(() => ({ values, activeId }), [values, activeId]);

  return (
    <TabsListContext.Provider value={ctx}>
      <TabsPrimitive.List
        ref={setRefs}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 p-1',
          className,
        )}
        {...props}
      />
    </TabsListContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors',
      'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs',
      'disabled:pointer-events-none disabled:opacity-50',
      '[&_svg]:size-4',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * Tab panel.
 *
 * Radix unmounts the inactive panel, so `data-[state]` only ever reads
 * `active` — there is no closed state to animate out. The crossfade therefore
 * runs on enter only, and the incoming panel slides in the direction of travel
 * (left for a later tab, right for an earlier one) so the content reads as
 * connected to the trigger rather than as an unrelated page swap.
 *
 * The direction comes from the trigger's position in the DOM, so it stays
 * correct for a wrapped or scrollable tab list.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const list = React.useContext(TabsListContext);
  const id = (props as { value?: string }).value;

  // Index of this panel versus the active one. -1 when the list hasn't mounted
  // yet, which falls back to entering from the right.
  const fromRight = React.useMemo(() => {
    if (!list || id == null) return true;
    const self = list.values.indexOf(id);
    const active = list.values.indexOf(list.activeId ?? '');
    if (self < 0 || active < 0) return true;
    return self >= active;
  }, [list, id]);

  const style = React.useMemo<React.CSSProperties>(
    () => ({ ['--tab-shift' as string]: fromRight ? '8px' : '-8px' }),
    [fromRight],
  );

  return (
    <TabsPrimitive.Content
      ref={ref}
      style={style}
      className={cn('animate-fade-in-up tab-panel focus-visible:outline-none', className)}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * Shared by TabsList and TabsContent so a panel knows which sibling is active.
 * Value rather than DOM measurement: this survives a tab list that reorders or
 * paginates, which an index captured at mount would not.
 */
const TabsListContext = React.createContext<{
  values: string[];
  activeId: string | null;
} | null>(null);

export { Tabs, TabsList, TabsTrigger, TabsContent };
