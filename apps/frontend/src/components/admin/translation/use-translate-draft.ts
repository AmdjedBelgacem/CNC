'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TranslatableField } from '@titan/shared';
import { coverageOf, type TranslationCoverage } from '@titan/shared';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

/**
 * One translation pass over a set of entities, shared by every admin surface.
 *
 * The old per-form button posted one request per form. A course with twelve lessons exceeds the
 * 40-field request cap on its own, and a lesson block editor has no batch path at all — so this
 * posts groups, keeps partial results when a group fails, and never persists: the caller decides
 * what to keep.
 */

export type TranslateScope = 'missing' | 'all';

export interface TranslateGroup {
  /** Caller-supplied key echoed back on the result, e.g. a lesson id. */
  key: string;
  /** Label -> English source text. */
  fields: Record<string, string>;
}

export interface TranslateRunMeta {
  model: string;
  usedFallback: boolean;
  /** Groups that came back with an error. */
  failedKeys: string[];
}

export interface UseTranslateDraftOptions {
  /** Human name of what is being translated, e.g. "course" — sharpens model phrasing. */
  entity: string;
  groups: TranslateGroup[];
  /**
   * Only fields with no Arabic yet, or every field regardless of state.
   *
   * Default `missing`, because re-translating fields an editor has already reviewed is the one
   * mistake this UI most needs to prevent.
   */
  scope?: TranslateScope;
  /** Refuse to run when Arabic already exists, unless the caller confirmed. */
  confirmOverwrite?: () => boolean;
  /**
   * Optional per-field predicate for the `missing` scope.
   *
   * Some callers have a translated draft in a shape the hook cannot inspect (for example a whole
   * page layout). Without this, "fill missing translations" was really "translate every field and
   * overwrite reviewed copy"; the caller knows which field keys already have a translation.
   */
  filterFields?: (groupKey: string, fieldKey: string, source: string) => boolean;
  /** Merges returned label -> Arabic text into whatever draft the caller holds. */
  onApply: (groupKey: string, translations: Record<string, string>) => void;
  /**
   * Field descriptors for this entity, when the caller wants `coverageFor`.
   *
   * Supplied explicitly rather than inferred from the labels, because a label is a display string
   * and not a path — inferring one would make coverage read `title` from a field labelled
   * "Bullet points" and report everything as missing.
   */
  descriptors?: TranslatableField[];
}

export interface UseTranslateDraftResult {
  busy: boolean;
  /**
   * Runs a pass. Pass a scope to override the default, so one menu can offer both "fill the gaps"
   * and "re-translate everything" without the hook holding that choice in state.
   */
  run: (scope?: TranslateScope) => Promise<TranslateRunMeta | null>;
  /** Fields still untranslated for a single entity, or null when no descriptors were given. */
  coverageFor: (source: unknown, translated: unknown) => TranslationCoverage | null;
}

export function useTranslateDraft({
  entity,
  groups,
  scope = 'missing',
  confirmOverwrite,
  filterFields,
  onApply,
  descriptors,
}: UseTranslateDraftOptions): UseTranslateDraftResult {
  const t = useTranslations('admin.translate');
  const [busy, setBusy] = useState(false);
  // Guards against a double-click firing two batches and doubling the AI cost.
  const inFlight = useRef(false);

  const pendingGroups = useMemo(() => {
    if (scope === 'all') return groups;
    return groups
      .map((group) => ({
        key: group.key,
        fields: Object.fromEntries(
          Object.entries(group.fields).filter(
            ([key, value]) =>
              Boolean(value && value.trim().length > 0) &&
              (filterFields?.(group.key, key, value) ?? true),
          ),
        ),
      }))
      .filter((group) => Object.keys(group.fields).length > 0);
  }, [filterFields, groups, scope]);

  const coverageFor = useCallback(
    (source: unknown, translated: unknown) => {
      if (!descriptors) return null;
      return coverageOf(source, (translated ?? null) as Record<string, unknown> | null, descriptors);
    },
    [descriptors],
  );

  const run = useCallback(async (scopeOverride?: TranslateScope): Promise<TranslateRunMeta | null> => {
    if (inFlight.current) return null;
    const effectiveScope = scopeOverride ?? scope;
    const groupsToSend = effectiveScope === 'all' ? groups : pendingGroups;
    if (groupsToSend.length === 0) {
      toast({ type: 'info', title: t('nothingMissing', { entity }) });
      return null;
    }
    if (effectiveScope === 'all' && confirmOverwrite && !confirmOverwrite()) return null;

    inFlight.current = true;
    setBusy(true);
    try {
      const result = await api.post<{
        groups: Array<{ key: string; translations: Record<string, string>; error?: string }>;
        translatedCount: number;
        failedCount: number;
        model: string;
        usedFallback: boolean;
      }>('/admin/ai/translate/batch', {
        sourceLocale: 'en',
        targetLocale: 'ar',
        groups: groupsToSend,
        entity,
      });

      const failedKeys: string[] = [];
      for (const group of result.groups ?? []) {
        if (group.error || Object.keys(group.translations ?? {}).length === 0) {
          if (group.error) failedKeys.push(group.key);
          continue;
        }
        onApply(group.key, group.translations);
      }

      const count = result.translatedCount ?? 0;
      if (count === 0) throw new Error(t('empty'));

      toast({
        type: failedKeys.length > 0 ? 'info' : 'ok',
        title: t('done', { count }),
        description:
          failedKeys.length > 0
            ? t('partial', { failed: failedKeys.length })
            : result.usedFallback
              ? t('fallbackUsed')
              : t('reviewHint'),
      });
      return {
        model: result.model,
        usedFallback: result.usedFallback,
        failedKeys,
      };
    } catch (error) {
      toast({ type: 'err', title: t('failed'), description: (error as Error).message });
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [confirmOverwrite, entity, groups, onApply, pendingGroups, scope, t]);

  return { busy, run, coverageFor };
}

