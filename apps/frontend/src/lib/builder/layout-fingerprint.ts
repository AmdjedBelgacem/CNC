/**
 * A comparison key for "has this layout changed since it was loaded or saved".
 *
 * Puck hands back its own representation of a layout: every slot is present as `[]` and a
 * top-level `zones: {}` is added, while the layout the server sent leaves those out. The two
 * describe the same page, but compared as raw JSON they never match — so editing something and
 * undoing it left "Unsaved changes" on a page that was identical to the saved one. Empty
 * arrays, empty objects and null/undefined values carry no content, so they are pruned from the
 * key, bottom-up, so an object that only held empty containers is pruned as well. Keys are
 * visited in sorted order because Puck and the server do not agree on property order either.
 */
function pruneEmpty(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(pruneEmpty);
    return items.length === 0 ? undefined : items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const pruned = pruneEmpty(v);
      if (pruned !== undefined) out[k] = pruned;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value === null ? undefined : value;
}

export function layoutFingerprint(layout: unknown): string {
  return JSON.stringify(pruneEmpty(layout) ?? null);
}
