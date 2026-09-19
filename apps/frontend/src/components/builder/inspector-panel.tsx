'use client';
import { SmartInspector } from './inspector/smart-inspector'; /** * Docked right sidebar — the contextual property inspector. Replaces Puck's * right sidebar entirely (Puck's own sidebar is disabled for performance). */
export function InspectorPanel() {
  return (
    <aside className="flex min-h-0 w-80 shrink-0 flex-col self-stretch overflow-hidden border-l border-border bg-card max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[85vw] max-lg:max-w-80 max-lg:animate-drawer-in-right max-lg:shadow-sm max-lg:shadow-black/20">
      {' '}
      <SmartInspector />{' '}
    </aside>
  );
}
