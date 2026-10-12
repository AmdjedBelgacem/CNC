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
      else missing.push(field.path);
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
          return { label: field.key, source: field.value, translation, missing: !translation.trim() };
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
