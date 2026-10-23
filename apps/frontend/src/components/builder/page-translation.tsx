'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  harvestPageLayout,
  applyPageTranslations,
  mergeLayoutStructure,
  readPageTranslationField,
  type PageLayout,
  type PageTranslation,
} from '@titan/shared';
import {
  TranslateAction,
  TranslationCoveragePanel,
  TranslationReviewDialog,
  useTranslateDraft,
} from '@/components/admin/translation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { useBuilderTranslation } from '@/components/builder/translation-context';

/**
 * Produces the Arabic copy of a page.
 *
 * A page is localized as a complete alternate layout, so this writes `translations.ar` alongside
 * the English layout rather than editing it. The English layout an editor is looking at is never
 * touched — otherwise an AI pass would leave the live page in a half-translated state whenever the
 * batch came back partial.
 */
export function PageTranslationPanel({
  slug,
  layout,
  existing,
  onSaved,
}: {
  slug: string;
  layout: PageLayout;
  existing: PageTranslation | null;
  onSaved?: (translation: PageTranslation) => void;
}) {
  const t = useTranslations('admin.translate');
  const translationCtx = useBuilderTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PageTranslation | null>(null);
  const [saving, setSaving] = useState(false);

  const harvested = useMemo(() => harvestPageLayout(layout), [layout]);
  /**
   * Saved Arabic may predate the current English structure. Align it by node id
   * first, otherwise inserting one block shifts every later position and the
   * coverage panel reads a different block's copy.
   *
   * The provider's tree is preferred over the page record: per-block Arabic
   * saves update it immediately, while the page record only refreshes on a
   * reload. Without this the coverage panel would keep showing old, untranslated
   * fields right after an inspector edit.
   */
  const existingLayout = translationCtx?.arabicLayout ?? existing?.layout ?? null;
  const existingAligned = useMemo(
    () => (existingLayout ? mergeLayoutStructure(layout, existingLayout) : null),
    [existingLayout, layout],
  );

  /**
   * Field keys that already have Arabic copy, for the "fill missing" scope.
   *
   * The hook only sees label -> English maps, so it cannot tell a reviewed translation from an
   * untranslated field. Passing this set keeps "missing" from quietly overwriting reviewed copy
   * (the full re-translate action is still available, behind its confirmation).
   */
  const reviewedKeys = useMemo(() => {
    const target = draft?.layout ?? existingAligned;
    if (!target) return new Set<string>();
    return new Set(
      harvested.harvested
        .filter((field) => {
          const value = readPageTranslationField(target, field);
          return typeof value === 'string' && value.trim() && value !== field.value;
        })
        .map((field) => field.key),
    );
  }, [draft, existingAligned, harvested]);

  /**
   * The translate endpoint accepts at most 40 fields per group. A builder page routinely has more
   * than that (this audit fixture has 71), so one group silently left the tail of the page
   * untranslated. Chunking keeps each request inside the cap and lets the hook keep partial
   * results when a single chunk fails.
   */
  const translationGroups = useMemo(() => {
    const entries = Object.entries(harvested.fields);
    const groups: { key: string; fields: Record<string, string> }[] = [];
    for (let index = 0; index < entries.length; index += 40) {
      groups.push({
        key: `page-${index / 40}`,
        fields: Object.fromEntries(entries.slice(index, index + 40)),
      });
    }
    return groups;
  }, [harvested.fields]);

  const { busy, run } = useTranslateDraft({
    entity: 'page content',
    groups: translationGroups,
    filterFields: (_group, key) => !reviewedKeys.has(key),
    onApply: (_key, translations) => {
      setDraft((prev) => {
        // Start from the Arabic copy that already exists, not from English. A "missing" pass now
        // sends only untranslated keys, so applying it to the English tree would erase every
        // translation the editor had already reviewed.
        const base = prev?.layout ?? existingAligned ?? harvested.layout;
        const layout = applyPageTranslations(
          { ...harvested, layout: mergeLayoutStructure(harvested.layout, base) },
          translations,
        );
        return { ...(prev ?? {}), layout };
      });
    },
    confirmOverwrite: () => window.confirm(t('overwriteConfirm')),
  });

  /**
   * Coverage against the saved Arabic layout, falling back to the unsaved draft so the bar moves as
   * soon as a translation arrives rather than only after a save.
   */
  const coverage = useMemo(() => {
    const target = draft?.layout ?? existingAligned;
    const fields = harvested.harvested;
    let translated = 0;
    const missing: string[] = [];
    for (const field of fields) {
      const value = readPageTranslationField(target, field);
      if (typeof value === 'string' && value.trim() && value !== field.value) translated += 1;
      // The field key carries the node address (`n3:` / `z:sidebar:0:`), while the
      // path is relative to that node's props. Show both so duplicate prop names
      // such as eight `text` fields remain distinguishable.
      else missing.push(humanizeFieldPath(field.path, field.key));
    }
    return { total: fields.length, translated, missing, present: [] };
  }, [draft, existingAligned, harvested]);

  const save = async () => {
    if (!draft?.layout) return;
    setSaving(true);
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ translations: { ar: { title: draft.title, layout: draft.layout } } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Save failed');
      toast({ type: 'ok', title: t('done', { count: coverage.translated }) });
      onSaved?.({ title: draft.title, layout: draft.layout });
      setDraft(null);
    } catch (error) {
      toast({ type: 'err', title: t('failed'), description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const hasTranslation = Boolean(existingLayout) || Boolean(draft?.layout);

  return (
    <div className="min-w-0 max-w-full space-y-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('page.title')}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {coverage.translated > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
              {t('menu.review')}
            </Button>
          )}
          <TranslateAction coverage={coverage} busy={busy} onTranslate={(scope) => void run(scope)} />
        </div>
      </div>
      <TranslationCoveragePanel coverage={coverage} />
      <p className="text-xs text-muted-foreground">{t('page.hint')}</p>
      {draft?.layout && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? t('working') : t('page.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            {t('review.close')}
          </Button>
        </div>
      )}
      {hasTranslation && !draft?.layout && (
        <p className="text-xs text-muted-foreground">{t('page.saved')}</p>
      )}
      <TranslationReviewDialog
        open={open}
        onOpenChange={setOpen}
        entityLabel={t('page.entity')}
        items={harvested.harvested.map((field) => {
          const translation = String(
            readPageTranslationField(draft?.layout ?? existingAligned, field) ?? '',
          );
          return {
            label: humanizeFieldPath(field.path, field.key),
            source: field.value,
            translation,
            // The aligned Arabic tree keeps English as a fallback for untranslated blocks, so a
            // non-empty value is not proof of translation. Identical copy is still missing.
            missing: !translation.trim() || translation.trim() === field.value.trim(),
          };
        })}
      />
    </div>
  );
}

/**
 * Turn an internal field path into something an editor can act on.
 *
 * `path` is relative to the node's props (`text`, `content.0.props.heading`). The optional
 * `fieldKey` prefix identifies the node: `n3:` or `z:<zone>:<index>:`. The prop name alone is not
 * enough — a realistic page has eight blocks with a `text` prop — so pair it with that address.
 */
export function humanizeFieldPath(path: string, fieldKey?: string): string {
  const pretty = (segment: string) =>
    segment
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

  /**
   * Keep the slot position in the label, not just the leaf prop name.
   *
   * One hero can contain two badges with a `text` prop. Collapsing both to "Block 1 · Text"
   * makes the review list ambiguous exactly where the editor needs to compare two different
   * Arabic lines.
   */
  const prettyPath = (value: string) =>
    value
      .split('.')
      .flatMap((segment) => {
        if (!segment || segment === 'props') return [];
        if (/^\d+$/.test(segment)) return [`item ${Number(segment) + 1}`];
        return [pretty(segment)];
      })
      .join(' · ');

  const address = fieldKey ?? path;
  // Zone ids may contain dots; use the final index before the prop separator.
  const zoneMatch = /^z:(.+):(\d+):(.+)$/.exec(address);
  if (zoneMatch) {
    return `${zoneMatch[1]} · item ${Number(zoneMatch[2]) + 1} · ${prettyPath(zoneMatch[3]!)}`;
  }
  const indexMatch = /^n(\d+):(.+)$/.exec(address);
  if (indexMatch) {
    return `Block ${Number(indexMatch[1]) + 1} · ${prettyPath(indexMatch[2]!)}`;
  }
  return prettyPath(path) || path;
}
