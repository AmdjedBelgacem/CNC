'use client';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY } from '@titan/shared';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectInput, TextInput } from '@/components/admin/admin-form';
import { slugify } from '@/components/admin/form-page';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';

/* -----------------------------------------------------------------------------
 * Create in one step.
 *
 * Creating used to be a full page per entity that asked for most of the record
 * before it existed, and for academies uploaded images only after the create
 * call came back — so a failed upload left half a record. Now creating asks for
 * the few things that define the record, makes a draft, and opens the editor,
 * where everything else (Arabic included) is filled with autosave.
 * --------------------------------------------------------------------------- */

export type EntityKind = 'product' | 'course' | 'academy';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACCENTS = ['#C2410C', '#1E40AF', '#047857', '#7C3AED', '#B65433', '#0F766E'];
const PATHS: Record<EntityKind, string> = { product: 'products', course: 'courses', academy: 'academy' };

type Option = { id: string; title: string };

/** Starter outlines: section keys, each with its lesson keys (titles come from the catalog). */
const OUTLINES: Record<'workshop' | 'academy', { section: string; lessons: string[] }[]> = {
  workshop: [
    { section: 'intro', lessons: ['welcome', 'setup'] },
    { section: 'practice', lessons: ['demo', 'exercise'] },
    { section: 'wrapUp', lessons: ['check'] },
  ],
  academy: [
    { section: 'foundations', lessons: ['welcome', 'safety'] },
    { section: 'core', lessons: ['concepts', 'demo'] },
    { section: 'practice', lessons: ['exercise'] },
    { section: 'checkpoint1', lessons: ['check'] },
    { section: 'advanced', lessons: ['concepts', 'exercise'] },
    { section: 'capstone', lessons: ['project', 'check'] },
  ],
};

async function seedOutline(
  courseId: string,
  outline: { section: string; lessons: string[] }[],
  t: (key: string) => string,
) {
  const stamp = Date.now().toString(36);
  for (const [i, part] of outline.entries()) {
    const series = await api.post<{ id: string }>('/admin/courses/series', {
      courseId,
      slug: `${part.section.toLowerCase()}-${i + 1}-${stamp}`,
      title: t(`outline.section.${part.section}`),
    });
    for (const [j, lesson] of part.lessons.entries()) {
      await api.post('/admin/courses/lessons', {
        seriesId: series.id,
        slug: `${lesson.toLowerCase()}-${i + 1}-${j + 1}-${stamp}`,
        title: t(`outline.lesson.${lesson}`),
      });
    }
  }
}

function useAcademies(enabled: boolean) {
  const [items, setItems] = useState<Option[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchWithRefresh('/api/proxy/admin/academies?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setItems(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return items;
}

function CreateForm({
  kind,
  onKindChange,
  onCancel,
  variant,
}: {
  kind: EntityKind;
  onKindChange?: (kind: EntityKind) => void;
  onCancel: () => void;
  variant: 'dialog' | 'page';
}) {
  const t = useTranslations('admin.editorKit.create');
  const router = useRouter();
  const formId = useId();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [academyId, setAcademyId] = useState('');
  const [template, setTemplate] = useState<'workshop' | 'academy' | 'blank'>('workshop');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const academies = useAcademies(kind === 'course');

  const effectiveSlug = slugEdited ? slug : slugify(name);
  const nameError = attempted && !name.trim() ? t('nameRequired') : null;
  const slugError = attempted && name.trim() && !SLUG_RE.test(effectiveSlug) ? t('slugInvalid') : null;
  const priceNumber = price.trim() === '' ? null : Number(price.replace(/,/g, ''));
  const priceError =
    kind === 'product' && attempted && priceNumber !== null && (!Number.isFinite(priceNumber) || priceNumber < 0)
      ? t('priceInvalid')
      : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (!name.trim() || !SLUG_RE.test(effectiveSlug) || priceError) return;
    if (kind === 'product' && priceNumber !== null && (!Number.isFinite(priceNumber) || priceNumber < 0)) return;
    setBusy(true);
    try {
      if (kind === 'product') {
        const created = await api.post<{ slug?: string }>('/admin/products', {
          title: name.trim(),
          slug: effectiveSlug,
          category: category.trim() || null,
          // Prices are stored in minor units; the field takes the shopper-facing amount.
          price: priceNumber === null ? null : Math.round(priceNumber * 100),
          pricingMode: priceNumber === null ? 'request' : 'fixed',
          currency: DEFAULT_CURRENCY,
        });
        router.push(`/admin/products/${created?.slug ?? effectiveSlug}/edit`);
      } else if (kind === 'course') {
        const created = await api.post<{ id?: string; slug?: string }>('/admin/courses', {
          title: name.trim(),
          slug: effectiveSlug,
          academyId: academyId || undefined,
          metadata: template === 'blank' ? undefined : { template },
        });
        // A template used to be stored and never read, so every course started empty
        // whatever was picked. Build its outline now; a failure here leaves a valid
        // course with a partial outline, which the editor shows and can finish.
        if (created?.id && template !== 'blank') {
          try {
            await seedOutline(created.id, OUTLINES[template], t);
          } catch {
            toast({ type: 'err', title: t('outlineFailed') });
          }
        }
        router.push(`/admin/courses/${created?.slug ?? effectiveSlug}/edit?step=curriculum`);
      } else {
        const created = await api.post<{ slug?: string }>('/admin/academies', {
          title: name.trim(),
          slug: effectiveSlug,
          accentColor: accent,
        });
        router.push(`/admin/academies/${created?.slug ?? effectiveSlug}/edit`);
      }
      toast({ type: 'ok', title: t('created') });
    } catch (error) {
      const status = (error as { status?: number }).status;
      const body = (error as { body?: { message?: string | string[] } }).body;
      const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
      setServerError(
        status === 409 ? t('slugTaken') : message || (error instanceof Error ? error.message : t('failed')),
      );
      setBusy(false);
    }
  };

  const kinds: { id: EntityKind; label: string }[] = [
    { id: 'product', label: t('kindProduct') },
    { id: 'course', label: t('kindCourse') },
    { id: 'academy', label: t('kindAcademy') },
  ];

  const body = (
    <div className="flex flex-col gap-5">
      {onKindChange && (
        <div role="tablist" aria-label={t('kindLabel')} className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={k.id === kind}
              onClick={() => onKindChange(k.id)}
              className={cn(
                'min-h-10 rounded-xl text-sm transition',
                k.id === kind ? 'bg-card font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={`${formId}-name`} className="block text-13 font-medium text-foreground">
          {t('name')}
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        </label>
        <TextInput
          id={`${formId}-name`}
          value={name}
          autoFocus
          invalid={!!nameError}
          aria-describedby={`${formId}-address`}
          placeholder={t(`namePlaceholder.${kind}`)}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11"
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        <div id={`${formId}-address`} className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {editingSlug ? (
            <span className="flex w-full items-center gap-2">
              <span dir="ltr">/{PATHS[kind]}/</span>
              <TextInput
                aria-label={t('address')}
                value={effectiveSlug}
                dir="ltr"
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                className="min-h-9 flex-1 font-mono text-xs"
              />
            </span>
          ) : (
            <>
              <span>{t('address')}:</span>
              <span dir="ltr">
                /{PATHS[kind]}/<span className="font-mono text-foreground">{effectiveSlug || '…'}</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingSlug(true)}
                className="min-h-6 font-medium text-primary hover:underline"
              >
                {t('change')}
              </button>
            </>
          )}
        </div>
        {slugError && <p className="text-xs text-destructive">{slugError}</p>}
      </div>

      {kind === 'product' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-cat`} className="block text-13 font-medium text-foreground">
              {t('category')}
            </label>
            <TextInput
              id={`${formId}-cat`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('categoryPlaceholder')}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-price`} className="block text-13 font-medium text-foreground">
              {t('price', { currency: DEFAULT_CURRENCY })}
            </label>
            <TextInput
              id={`${formId}-price`}
              value={price}
              inputMode="decimal"
              dir="ltr"
              invalid={!!priceError}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t('pricePlaceholder')}
              className="min-h-11"
            />
            {priceError && <p className="text-xs text-destructive">{priceError}</p>}
          </div>
        </div>
      )}

      {kind === 'course' && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-academy`} className="block text-13 font-medium text-foreground">
              {t('academy')}
            </label>
            <SelectInput
              id={`${formId}-academy`}
              value={academyId}
              onChange={(e) => setAcademyId(e.target.value)}
              className="min-h-11"
            >
              <option value="">{t('noAcademy')}</option>
              {academies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </SelectInput>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-13 font-medium text-foreground">{t('startFrom')}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['workshop', 'academy', 'blank'] as const).map((id) => (
                <label
                  key={id}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition',
                    template === id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-border-strong',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="radio"
                      name={`${formId}-template`}
                      checked={template === id}
                      onChange={() => setTemplate(id)}
                      className="accent-primary"
                    />
                    {t(`template.${id}`)}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{t(`template.${id}Hint`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {kind === 'academy' && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-13 font-medium text-foreground">{t('accent')}</legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={accent === color}
                onClick={() => setAccent(color)}
                style={{ backgroundColor: color }}
                className={cn(
                  'size-10 rounded-full transition',
                  accent === color && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                )}
              />
            ))}
          </div>
        </fieldset>
      )}

      <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">{t('draftNote')}</p>
      {serverError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {serverError}
        </p>
      )}
    </div>
  );

  const footer = (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-card px-5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        {t('cancel')}
      </button>
      <button
        type="submit"
        form={formId}
        disabled={busy}
        className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t('createAndOpen')}
      </button>
    </>
  );

  if (variant === 'page') {
    return (
      <form
        id={formId}
        onSubmit={submit}
        noValidate
        className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      >
        <div className="flex flex-col gap-1.5 px-6 pb-2 pt-6">
          <h1 className="font-display text-[1.625rem] font-medium tracking-[-0.015em] text-foreground">
            {t(`title.${kind}`)}
          </h1>
          <p className="text-sm text-muted-foreground">{t(`lead.${kind}`)}</p>
        </div>
        <div className="px-6 py-5">{body}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="contents">
      <DialogHeader>
        <DialogTitle>{t(`title.${kind}`)}</DialogTitle>
        <DialogDescription>{t(`lead.${kind}`)}</DialogDescription>
      </DialogHeader>
      <DialogBody>{body}</DialogBody>
      <DialogFooter>{footer}</DialogFooter>
    </form>
  );
}

/** The create dialog, opened from a list page's New button. */
export function CreateEntityDialog({
  open,
  onOpenChange,
  kind: initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: EntityKind;
}) {
  const [kind, setKind] = useState<EntityKind>(initialKind);
  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <CreateForm
          key={kind}
          kind={kind}
          onKindChange={setKind}
          onCancel={() => onOpenChange(false)}
          variant="dialog"
        />
      </DialogContent>
    </Dialog>
  );
}

/** The same form as a page, for the `/new` routes that bookmarks and links still reach. */
export function CreateEntityPage({ kind, backHref }: { kind: EntityKind; backHref: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[70vh] items-start justify-center px-4 pt-10 sm:pt-16">
      <CreateForm kind={kind} onCancel={() => router.push(backHref)} variant="page" />
    </div>
  );
}
