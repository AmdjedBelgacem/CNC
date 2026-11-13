'use client';

import { useSyncExternalStore } from 'react';

/**
 * Remembers the shape of data-sized admin screens so their loading skeletons can match them.
 *
 * A skeleton renders before the page's data arrives, so it cannot know how many menu items the
 * navigation editor will show. The editor records the shape each time it loads; the skeleton
 * reads it on the next visit. The first visit on a device uses the fallback.
 *
 * Reads go through `useSyncExternalStore` with a server snapshot of `null`, so the server render
 * and the hydrating render agree, and the remembered shape applies right after hydration.
 */

const NAV_SHAPE_KEY = 'admin:navigation-shape';

interface NavShapeNode {
  children?: NavShapeNode[] | null;
}

/** One entry per rendered row: 0 for a top-level item, 1 for an item inside a group. */
export function navShapeOf(tree: NavShapeNode[]): number[] {
  const depths: number[] = [];
  for (const node of tree) {
    depths.push(0);
    for (let i = 0; i < (node.children?.length ?? 0); i += 1) depths.push(1);
  }
  return depths;
}

export function rememberNavShape(tree: NavShapeNode[]): void {
  try {
    window.localStorage.setItem(NAV_SHAPE_KEY, JSON.stringify(navShapeOf(tree)));
  } catch {
    // Private mode or blocked storage: the skeleton keeps its fallback.
  }
}

function readNavShape(): string | null {
  try {
    return window.localStorage.getItem(NAV_SHAPE_KEY);
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

export function parseNavShape(raw: string | null, fallback: number[]): number[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.length <= 60 &&
      parsed.every((depth) => depth === 0 || depth === 1)
    ) {
      return parsed as number[];
    }
  } catch {
    // Corrupt value: fall through.
  }
  return fallback;
}

/** The remembered row depths, or `fallback` before hydration and on a first visit. */
export function useRememberedNavShape(fallback: number[]): number[] {
  const raw = useSyncExternalStore(noSubscription, readNavShape, () => null);
  return parseNavShape(raw, fallback);
}
