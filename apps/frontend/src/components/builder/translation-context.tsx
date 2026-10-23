'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  findNodeById,
  mergeLayoutStructure,
  type HarvestedField,
  type PageLayout,
  type PuckNode,
} from '@titan/shared';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

/**
 * Per-block translation state for the builder.
 *
 * The page stores Arabic as a complete alternate layout (`page.translations.ar.layout`), so
 * editing one block's Arabic text means writing into that tree at the same node id. This context
 * owns that tree and exposes helpers so the inspector can read/write a single block's Arabic
 * fields without knowing the path scheme.
 */
export interface BuilderTranslationContextValue {
  /** The Arabic layout tree, or null if no Arabic copy exists yet. */
  arabicLayout: PageLayout | null;
  /**
   * Update one prop path on a node identified by its stable `props.id`.
   *
   * `fieldPath` is relative to the node's props (e.g. `text` or `content.0.props.heading`),
   * matching the paths `harvestBlock` returns.
   */
  setArabicField: (nodeId: string, fieldPath: string, value: string) => void;
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

/** Write a harvested prop path into a cloned prop object. */
function setAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return;
  let current: any = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    let next = current[key];
    if (next == null || typeof next !== 'object') {
      next = /^\d+$/.test(keys[i + 1]!) ? [] : {};
      current[key] = next;
    }
    current = next;
  }
  const last = keys[keys.length - 1]!;
  if (Array.isArray(current) && /^\d+$/.test(last)) current[Number(last)] = value;
  else current[last] = value;
}

export function BuilderTranslationProvider({
  initialArabicLayout,
  englishLayout,
  onPersist,
  children,
}: ProviderProps) {
  const [arabicLayout, setArabicLayout] = useState<PageLayout | null>(initialArabicLayout);
  const latestLayout = useRef<PageLayout | null>(initialArabicLayout);
  // Keep latestLayout in sync for the debounced persist closure.
  useEffect(() => {
    latestLayout.current = arabicLayout;
  }, [arabicLayout]);
  // The provider is mounted before `page` resolves in builder-editor, so the initial props are
  // null. Sync them in once the page loads, otherwise `setArabicField` has no seed tree and
  // silently no-ops.
  useEffect(() => {
    setArabicLayout(initialArabicLayout);
    latestLayout.current = initialArabicLayout;
  }, [initialArabicLayout]);
  const englishRef = useRef<PageLayout | null>(englishLayout);
  useEffect(() => {
    englishRef.current = englishLayout;
  }, [englishLayout]);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flush a pending debounced save when the provider unmounts (e.g. page switch), so an edit
  // made in the last 800ms is not silently lost.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        const layout = latestLayout.current;
        if (layout) void onPersist(layout);
      }
    };
  }, [onPersist]);

  const schedulePersist = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const layout = latestLayout.current;
      if (layout) void onPersist(layout);
    }, 800);
  }, [onPersist]);

  const setArabicField = useCallback(
    (nodeId: string, fieldPath: string, value: string) => {
      if (!nodeId || !fieldPath) return;
      setArabicLayout((prev) => {
        const english = englishRef.current;
        // English is authoritative for structure. Merging before every write means a block
        // added on the English page is also addressable in Arabic, and a stale Arabic tree can
        // never make the inspector write into the wrong node.
        let base: PageLayout | null;
        if (english) base = prev ? mergeLayoutStructure(english, prev) : english;
        else base = prev;
        if (!base) return prev;

        const next = structuredClone(base);
        const node = findNodeById(next, nodeId);
        if (!node) return prev;
        if (!node.props || typeof node.props !== 'object') node.props = {};
        setAtPath(node.props as Record<string, unknown>, fieldPath, value);
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const translateBlock = useCallback(
    async (englishNode: PuckNode, fields: HarvestedField[]) => {
      if (fields.length === 0) return;
      const nodeId = englishNode.props?.id;
      if (typeof nodeId !== 'string' || !nodeId) return;
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
        if (group?.error) throw new Error(group.error);
        let count = 0;
        if (group?.translations) {
          // The API returns the same field keys we sent; write each value into the Arabic node
          // through the same path-based setter the manual textareas use.
          for (const field of fields) {
            const translated = group.translations[field.key];
            if (translated?.trim()) {
              setArabicField(nodeId, field.path, translated);
              count += 1;
            }
          }
        }
        if (count === 0) throw new Error('The translator returned no Arabic text.');
        toast({
          type: 'ok',
          title: `Translated ${count} field${count === 1 ? '' : 's'}`,
          description: 'Review the Arabic copy before publishing.',
        });
      } catch (err) {
        toast({
          type: 'err',
          title: 'Block translation failed',
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setTranslating(false);
      }
    },
    [setArabicField],
  );

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
