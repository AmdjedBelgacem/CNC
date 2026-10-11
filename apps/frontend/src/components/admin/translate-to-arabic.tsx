'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Languages, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';

/**
 * Translate the English fields on this form into Arabic with the tenant's own AI provider.
 *
 * Nothing is saved here. The result comes back as a map and is handed to `onTranslated`, which
 * fills the form's Arabic inputs, so the editor reviews machine output before it can reach the
 * live site. Overwriting existing Arabic is opt-in via `hasArabic`, because a page can already
 * have human-reviewed copy that a re-translation would silently replace.
 */
export interface TranslateToArabicProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Field label to English source text. Empty strings are skipped by the API. */
  fields: Record<string, string>;
  /** What is being translated, e.g. "course description" — improves the model's phrasing. */
  entity?: string;
  /** Receives label → Arabic text. Apply it to the form however you like. */
  onTranslated: (
    translations: Record<string, string>,
    meta: { model: string; usedFallback: boolean },
  ) => void;
  /** True when Arabic copy already exists; enables the confirm overwrite. */
  hasArabic?: boolean;
}

export function TranslateToArabic({
  fields,
  entity,
  onTranslated,
  hasArabic,
  variant = 'outline',
  size = 'sm',
  ...rest
}: TranslateToArabicProps) {
  const t = useTranslations('admin.translate');
  const [busy, setBusy] = useState(false);

  const populated = Object.values(fields).filter(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
  const disabled = busy || populated.length === 0;

  const run = async () => {
    if (disabled) return;
    if (hasArabic && !window.confirm(t('overwriteConfirm'))) return;
    setBusy(true);
    try {
      const result = await api.post<{
        translations: Record<string, string>;
        model: string;
        usedFallback: boolean;
      }>('/admin/ai/translate', {
        sourceLocale: 'en',
        targetLocale: 'ar',
        fields,
        entity,
      });
      const count = Object.keys(result.translations ?? {}).length;
      if (count === 0) throw new Error(t('empty'));
      onTranslated(result.translations, { model: result.model, usedFallback: result.usedFallback });
      toast({
        type: 'ok',
        title: t('done', { count }),
        description: result.usedFallback ? t('fallbackUsed') : t('reviewHint'),
      });
    } catch (error) {
      toast({ type: 'err', title: t('failed'), description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={run} disabled={disabled} {...rest}>
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Languages className="size-3.5" aria-hidden />
      )}
      {busy ? t('working') : t('button')}
    </Button>
  );
}
