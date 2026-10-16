'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { PageLayout, PuckNode } from '@titan/shared';
import type { HarvestedField } from '@titan/shared';
import { api } from '@/lib/api-client';

/**
 * Per-block translation state for the builder.
 *
 * The page stores Arabic as a complete alternate layout (`page.translations.ar.layout`), so
 * editing one block's Arabic text means finding the matching node in that tree and writing
 * there. This context owns that tree and exposes helpers so the inspector can read/write a
 * single block's Arabic fields without knowing the path scheme.
 */
export interface BuilderTranslationContextValue {
  /** The Arabic layout tree, or null if no Arabic copy exists yet. */
  arabicLayout: PageLayout | null;
  /** Update one harvested field's Arabic value. `key` is the harvester's label (e.g. `n3.props.text`). */
  setArabicField: (key: string, value: string) => void;
  /** Translate a single block's harvested fields via AI and merge them into the Arabic layout. */
  translateBlock: (englishNode: PuckNode, fields: HarvestedField[]) => Promise<void>;
  /** Persist the Arabic layout to the server. */
  persistArabic: () => Promise<void>;
  /** True while an AI translate is in flight. */
  translating: boolean;
  /** True while a persist is in flight. */
  saving: boolean;
}

const BuilderTranslationContext = createContext<BuilderTranslationContextValue | null>(null);

export function useBuilderTranslation() {
  return useContext(BuilderTranslationContext);
}

interface ProviderProps {
  initialArabicLayout: PageLayout | null;
  englishLayout: PageLayout | null;
  onPersist: (layout: PageLayout) => Promise<void>;
  children: ReactNode;
}

export function BuilderTranslationProvider({ initialArabicLayout, englishLayout, onPersist, children }: ProviderProps) {
  const [arabicLayout, setArabicLayout] = useState<PageLayout | null>(initialArabicLayout);
  // Keep latestLayout in sync for the debounced persist closure.
  useEffect(() => {
    latestLayout.current = arabicLayout;
  }, [arabicLayout]);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLayout = useRef<PageLayout | null>(initialArabicLayout);
  // Flush a pending debounced save when the provider unmounts (e.g. page switch), so an edit
  // made in the last 800ms is not silently lost.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const layout = latestLayout.current;
        if (layout) void onPersist(layout);
      }
    };
  }, [onPersist]);

  const schedulePersist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const layout = latestLayout.current;
      if (layout) void onPersist(layout);
    }, 800);
  }, [onPersist]);

  const setArabicField = useCallback((fieldKey: string, value: string) => {
    // fieldKey is the harvester's label, e.g. `n3:props.text` or `z:content:0:props.title`.
    // Split off the node id first (everything before the first colon), then walk the prop path.
    const colonIdx = fieldKey.indexOf(':');
    const nodeKey = colonIdx >= 0 ? fieldKey.slice(0, colonIdx) : fieldKey;
    const propPath = colonIdx >= 0 ? fieldKey.slice(colonIdx + 1) : '';
    const propSegments = propPath.split('.').filter(Boolean);

    setArabicLayout((prev) => {
      let base: PageLayout | null = prev;
      if (!base && englishLayout) {
        base = JSON.parse(JSON.stringify(englishLayout)) as PageLayout;
      }
      if (!base) return base;

      // Resolve the top-level node in the Arabic tree.
      let cursor: any = base;
      if (nodeKey.startsWith('n')) {
        const idx = Number(nodeKey.slice(1));
        if (!base.content) base.content = [];
        if (base.content[idx] == null) base.content[idx] = JSON.parse(JSON.stringify((englishLayout as any)?.content?.[idx] ?? {}));
        cursor = base.content[idx];
      } else if (nodeKey.startsWith('z:')) {
        const parts = nodeKey.split(':');
        const zone = parts[1];
        const idx = Number(parts[2]);
        if (zone) {
          if (!base.zones) base.zones = {};
          if (!base.zones[zone]) base.zones[zone] = [];
          if (base.zones[zone][idx] == null) base.zones[zone][idx] = JSON.parse(JSON.stringify((englishLayout as any)?.zones?.[zone]?.[idx] ?? {}));
          cursor = base.zones[zone][idx];
        }
      }
      if (!cursor) return base;
      if (!cursor.props) cursor.props = {};

      // Walk the prop path (props.text, props.title, ...).
      let leaf: any = cursor.props;
      for (let i = 0; i < propSegments.length - 1; i++) {
        const seg = propSegments[i]!;
        if (leaf[seg] == null) leaf[seg] = {};
        leaf = leaf[seg];
      }
      const last = propSegments[propSegments.length - 1];
      if (last) leaf[last] = value;

      return { ...base };
    });
    schedulePersist();
  }, [englishLayout, schedulePersist]);

  const translateBlock = useCallback(async (_englishNode: unknown, fields: HarvestedField[]) => {
    if (fields.length === 0) return;
    setTranslating(true);
    try {
      const result = await api.post<{
        groups: Array<{ key: string; translations: Record<string, string>; error?: string }>;
      }>('/admin/ai/translate/batch', {
        sourceLocale: 'en',
        targetLocale: 'ar',
        groups: [{ key: 'block', fields: Object.fromEntries(fields.map((f) => [f.key, f.value])) }],
        entity: 'block content',
      });
      const group = result.groups?.[0];
      if (group?.translations) {
        // Each translation key is the harvested field key (e.g. `n3:props.text`), which is exactly
        // the address setArabicField expects. Writing them one at a time keeps the Arabic tree
        // in sync without reconstructing block objects.
        for (const [key, value] of Object.entries(group.translations)) {
          setArabicField(key, value);
        }
      }
    } catch (err) {
      console.warn('Block translate failed:', err);
    } finally {
      setTranslating(false);
    }
  }, [setArabicField]);

  const persistArabic = useCallback(async () => {
    const layout = latestLayout.current;
    if (!layout) return;
    setSaving(true);
    try {
      await onPersist(layout);
    } finally {
      setSaving(false);
    }
  }, [onPersist]);

  return (
    <BuilderTranslationContext.Provider
      value={{ arabicLayout, setArabicField, translateBlock, persistArabic, translating, saving }}
    >
      {children}
    </BuilderTranslationContext.Provider>
  );
}