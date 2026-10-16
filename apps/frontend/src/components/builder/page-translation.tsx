'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  harvestPageLayout,
  applyPageTranslations,
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
  onSaved?: () => void;
}) {
  const t = useTranslations('admin.translate');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PageTranslation | null>(null);
  const [saving, setSaving] = useState(false);

  const harvested = useMemo(() => harvestPageLayout(layout), [layout]);

  const { busy, run } = useTranslateDraft({
    entity: 'page content',
    groups: [{ key: 'page', fields: harvested.fields }],
    onApply: (_key, translations) => {
      setDraft((prev) => ({
        ...(prev ?? {}),
        layout: applyPageTranslations(harvested, translations),
      }));
    },
    confirmOverwrite: () => window.confirm(t('overwriteConfirm')),
  });

  /**
   * Coverage against the saved Arabic layout, falling back to the unsaved draft so the bar moves as
   * soon as a translation arrives rather than only after a save.
   */
  const coverage = useMemo(() => {
    const target = draft?.layout ?? existing?.layout;
    const fields = harvested.harvested;
    let translated = 0;
    const missing: string[] = [];
    for (const field of fields) {
      const value = readAt(target ?? {}, field.path);
      if (typeof value === 'string' && value.trim() && value !== field.value) translated += 1;
      // A human label, not `field.path`. The paths are `n3.props.heading` and the panel used to
      // join them straight into the "untranslated" sentence, so opening this panel printed a
      // dotted list of internal locators at the editor instead of naming anything. The path is
      // still what identifies the field everywhere else — only this display string changes.
      else missing.push(humanizeFieldPath(field.path));
    }
    return { total: fields.length, translated, missing, present: [] };
  }, [draft, existing, harvested]);

  const save = async () => {
    if (!draft?.layout) return;
    setSaving(true);
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({ translations: { ar: { title: draft.title, layout: draft.layout } } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Save failed');
      toast({ type: 'ok', title: t('done', { count: coverage.total }) });
      setDraft(null);
      onSaved?.();
    } catch (error) {
      toast({ type: 'err', title: t('failed'), description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const hasTranslation = Boolean(existing?.layout) || Boolean(draft?.layout);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t('page.title')}</p>
        <div className="flex items-center gap-2">
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
            readAt(draft?.layout ?? existing?.layout ?? {}, field.path) ?? '',
          );
          // Same reason as the coverage list: `field.key` is the dotted path, and it was being
          // used as the row heading, so every row was titled `n3.props.heading`.
          return {
            label: humanizeFieldPath(field.path),
            source: field.value,
            translation,
            missing: !translation.trim(),
          };
        })}
      />
    </div>
  );
}

function readAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Turn an internal field path into something an editor can act on.
 *
 * Harvested paths look like `n3.props.heading` or `z:hero.1.props.title` — the first segment is
 * the node's position in the tree, because `PuckNode` carries no stable id and the write-back
 * addresses positions too.
 *
 * The prop name alone is not enough: a realistic page has eight blocks with a `text` prop, so
 * eight rows all reading "Text" would be no better than the paths. Pairing it with the position
 * gives "Block 4 · Heading", which an editor can actually match to the canvas.
 */
export function humanizeFieldPath(path: string): string {
  const segments = path.split('.');
  const prop = segments[segments.length - 1] ?? path;
  const node = segments[0] ?? '';

  const prettyProp = prop
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

  // Zone nodes are keyed `z:<zone>:<index>` — colons, because the dot is the path separator and
  // the zone id itself can contain dots (`z:hero.main:0`).
  const zoneMatch = /^z:([\w.-]+):(\d+)$/.exec(node);
  if (zoneMatch) {
    return `${zoneMatch[1]} · item ${Number(zoneMatch[2]) + 1} · ${prettyProp}`;
  }

  const indexMatch = /^n(\d+)$/.exec(node);
  if (indexMatch) {
    return `Block ${Number(indexMatch[1]) + 1} · ${prettyProp}`;
  }

  return prettyProp || path;
}
