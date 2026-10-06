'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { EMAIL_CATEGORY_LABELS, type EmailCategory, type EmailTemplateSummary } from '@titan/shared';
import { AdminPageHeader } from '@/components/admin/admin-chrome';
import { BarButton, BarPrimaryButton } from '@/components/admin/admin-chrome';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, Mail, Plus } from 'lucide-react';

const CATEGORIES = Object.keys(EMAIL_CATEGORY_LABELS) as EmailCategory[];

/** Explicit map rather than a template string, so the runtime-message-keys test
 *  can still verify that every lookup resolves. */
const STATUS_LABEL: Record<string, 'status_draft' | 'status_published' | 'status_archived'> = {
  draft: 'status_draft',
  published: 'status_published',
  archived: 'status_archived',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function EmailTemplatesList() {
  const t = useTranslations('admin.email');
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Create form
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<EmailCategory>('custom');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: EmailTemplateSummary[] }>('/admin/email/templates');
      setTemplates(res?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? templates : templates.filter((x) => x.category === filter)),
    [templates, filter],
  );

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/admin/email/templates', {
        name: trimmed,
        slug: slugTouched ? slug.trim() || slugify(trimmed) : slugify(trimmed),
        category,
      });
      setCreating(false);
      setName('');
      setSlug('');
      setSlugTouched(false);
      setCategory('custom');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const x of templates) map[x.category] = (map[x.category] ?? 0) + 1;
    return map;
  }, [templates]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('templatesTitle')}
        description={t('templatesDescription')}
        badge={
          <BarPrimaryButton onClick={() => setCreating((v) => !v)} disabled={creating}>
            <Plus className="size-4" />
            {t('newTemplate')}
          </BarPrimaryButton>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {creating && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name">{t('fieldName')}</Label>
              <Input
                id="tmpl-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-slug">{t('fieldSlug')}</Label>
              <Input
                id="tmpl-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="order-receipt"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fieldCategory')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EmailCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EMAIL_CATEGORY_LABELS[c]} ({counts[c] ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <BarPrimaryButton onClick={create} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t('create')}
            </BarPrimaryButton>
            <BarButton onClick={() => setCreating(false)}>{t('cancel')}</BarButton>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          {t('allCategories')} ({templates.length})
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {EMAIL_CATEGORY_LABELS[c]} ({counts[c] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('loading')}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('colName')}</th>
                <th className="px-4 py-2.5 font-medium">{t('colCategory')}</th>
                <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
                <th className="px-4 py-2.5 font-medium">{t('colVersion')}</th>
                <th className="px-4 py-2.5 font-medium">{t('colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tpl) => (
                <tr key={tpl.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/email/templates/${tpl.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <Mail className="size-4 text-muted-foreground" />
                      {tpl.name}
                    </Link>
                    <div className="ps-6 font-mono text-xs text-muted-foreground">{tpl.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {EMAIL_CATEGORY_LABELS[tpl.category] ?? tpl.category}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tpl.status === 'published'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : tpl.status === 'archived'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {t(STATUS_LABEL[tpl.status] ?? 'status_draft')}
                    </span>
                    {tpl.isSystem && (
                      <span className="ms-1.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t('systemBadge')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {tpl.status === 'published' ? `v${tpl.version}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(tpl.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
