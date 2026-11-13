'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Boxes,
  Check,
  FileText,
  ImageIcon,
  Languages,
  Package,
  Search,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import {
  DEFAULT_CURRENCY,
  HOTSPOT_FIELDS,
  PRODUCT_FIELDS,
  coverageOf,
  isCurrencyCode,
  type CurrencyCode,
  type InteractiveHotspot,
  type TranslationCoverage,
} from '@titan/shared';
import { SlugField, type SectionNavItem } from '@/components/admin/form-page';
import {
  BilingualField,
  EditorSection,
  useLanguageMode,
  type RailSection,
} from '@/components/admin/editor/editor-kit';
import { TranslateAction, useTranslateDraft } from '@/components/admin/translation';
import {
  FieldGrid,
  SelectField,
  SwitchField,
  TextArea,
  TextField,
  TextInput,
} from '@/components/admin/admin-form';
import { ErrorBanner } from '@/components/admin/admin-ui';
import { makeId } from '@/lib/lesson-blocks';
import { uploadFileToStorage, uploadImage } from '@/lib/upload';
import { toast } from '@/components/ui/toast';
import { fetchWithRefresh } from '@/hooks/use-api-proxy';

/* The create and edit screens collect the same ~20 fields. They are defined
 * once here so the two screens cannot drift apart — previously the currency
 * default and the offered currency list were duplicated, and had already
 * diverged from the platform default. */

export interface ProductFormValue {
  title: string;
  slug: string;
  tagline: string;
  description: string;
  /**
   * Arabic copy, stored under `translations.ar`.
   *
   * The column has always existed and storefront search reads it, but the admin form had no way
   * to set it — so a bilingual product could only be produced by writing SQL. `features` is a
   * list and is sent as a block rather than per-bullet, because translating bullets one at a time
   * loses their alignment with the English list.
   */
  translationsAr: {
    title: string;
    tagline: string;
    description: string;
    features: string;
    seoTitle: string;
    seoDescription: string;
    /**
     * Arabic hotspot copy, keyed by hotspot id.
     *
     * Keyed rather than positional so a pin keeps its translated label when it is moved or when a
     * new one is added — a positional list reattaches Arabic text to whichever pin happens to sit
     * at that index.
     */
    hotspots: Record<string, { label: string; tooltip: string; detail: string }>;
  };
  category: string;
  productType: string;
  priceCents: string;
  pricingMode: 'fixed' | 'from' | 'request';
  compareAtCents: string;
  currency: string;
  inventory: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  isDigital: boolean;
  featured: boolean;
  sortOrder: string;
  tags: string;
  features: string;
  academyId: string;
  courseId: string;
  seoTitle: string;
  seoDescription: string;
  thumbnailUrl: string | null;
  pinpoints: InteractiveHotspot[];
  documents: ProductDocument[];
}

export interface ProductDocument {
  title: string;
  url: string;
  name?: string;
  size?: number;
}

export interface ProductFormOptions {
  academyId: string | null | undefined;
  courseId: string | null | undefined;
}

/** Every currency the storefront supports, not a hand-picked subset. */
const CURRENCIES: CurrencyCode[] = [
  'SAR', 'USD', 'EUR', 'GBP', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD',
  'EGP', 'TRY', 'INR', 'PKR', 'CNY', 'JPY', 'SGD', 'AUD', 'CAD', 'ZAR',
];

/** Currencies whose smallest unit is 1/100, so the minor-unit field means cents. */
function fractionDigits(code: string): number {
  return ['JPY', 'KRW'].includes(code) ? 0 : 2;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'product'
  );
}

/**
 * A blank product form.
 *
 * Exported rather than inlined in the hook so the payload builder can be tested without React and
 * so a field added here cannot be forgotten in one of two places.
 */
export function emptyProductForm(): ProductFormValue {
  return {
    title: '',
    slug: '',
    tagline: '',
    description: '',
    // A new product starts monolingual and stays that way until someone translates it, so an
    // empty Arabic block is the normal initial state rather than an error.
    translationsAr: emptyArabicProduct(),
    category: '',
    productType: '',
    priceCents: '',
    pricingMode: 'fixed',
    compareAtCents: '',
    // Default to the platform currency. A store that charges in SAR must not
    // silently default to USD, which is what this did before.
    currency: DEFAULT_CURRENCY,
    inventory: '0',
    trackInventory: true,
    allowBackorder: false,
    isDigital: false,
    featured: false,
    sortOrder: '0',
    tags: '',
    features: '',
    academyId: '',
    courseId: '',
    seoTitle: '',
    seoDescription: '',
    thumbnailUrl: null,
    pinpoints: [],
    documents: [],
  };
}

export function emptyArabicProduct(): ProductFormValue['translationsAr'] {
  return {
    title: '',
    tagline: '',
    description: '',
    features: '',
    seoTitle: '',
    seoDescription: '',
    hotspots: {},
  };
}

export function useProductForm(initial?: Partial<ProductFormValue>) {
  const [value, setValue] = useState<ProductFormValue>({
    ...emptyProductForm(),
    ...initial,
    translationsAr: initial?.translationsAr ?? emptyArabicProduct(),
  });
  const set = <K extends keyof ProductFormValue>(
    key: K,
    next: ProductFormValue[K] | ((prev: ProductFormValue[K]) => ProductFormValue[K]),
  ) =>
    setValue((v) => ({
      ...v,
      [key]: typeof next === 'function' ? (next as (prev: ProductFormValue[K]) => ProductFormValue[K])(v[key]) : next,
    }));
  /** Replace the whole form, used by "discard changes". */
  const reset = useCallback((next: ProductFormValue) => setValue(next), []);
  return { value, set, reset, setValue };
}

export function productFormPayload(value: ProductFormValue) {
  const ar = value.translationsAr;
  const hotspotTranslations = Object.fromEntries(
    Object.entries(ar.hotspots ?? {})
      // Drop entries the editor left blank, so an untouched pin does not send an empty object that
      // would read as "translated but empty" in coverage.
      .filter(([, copy]) => copy.label.trim() || copy.tooltip.trim() || copy.detail.trim())
      .map(([id, copy]) => [
        id,
        {
          label: copy.label.trim() || undefined,
          tooltip: copy.tooltip.trim() || undefined,
          detail: copy.detail.trim() || undefined,
        },
      ]),
  );
  // Every Arabic field must be considered here, not just the visible ones: an editor who only
  // filled in the Arabic SEO title would otherwise have it silently dropped on save.
  const hasArabic = Boolean(
    ar.title.trim() ||
      ar.tagline.trim() ||
      ar.description.trim() ||
      ar.features.trim() ||
      ar.seoTitle.trim() ||
      ar.seoDescription.trim() ||
      Object.keys(hotspotTranslations).length > 0,
  );
  return {
    translations: hasArabic
      ? {
          ar: {
            title: ar.title.trim() || undefined,
            tagline: ar.tagline.trim() || null,
            description: ar.description.trim() || null,
            features: ar.features
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
            seoTitle: ar.seoTitle.trim() || undefined,
            seoDescription: ar.seoDescription.trim() || undefined,
            ...(Object.keys(hotspotTranslations).length > 0 ? { hotspots: hotspotTranslations } : {}),
          },
        }
      : null,
    title: value.title.trim(),
    slug: value.slug.trim() || slugify(value.title),
    tagline: value.tagline.trim() || null,
    description: value.description.trim() || null,
    category: value.category.trim() || null,
    productType: value.productType.trim() || null,
    price: value.priceCents.trim() ? Math.round(Number(value.priceCents)) : null,
    pricingMode: value.pricingMode,
    compareAtPrice: value.compareAtCents ? Math.round(Number(value.compareAtCents)) : null,
    pinpoints: value.pinpoints.length > 0 ? value.pinpoints : null,
    documents: value.documents.length > 0 ? value.documents : null,
    currency: value.currency,
    inventory: Math.round(Number(value.inventory) || 0),
    trackInventory: value.trackInventory,
    allowBackorder: value.allowBackorder,
    isDigital: value.isDigital,
    featured: value.featured,
    sortOrder: Math.round(Number(value.sortOrder) || 0),
    tags: value.tags ? value.tags.split(',').map((s) => s.trim()).filter(Boolean) : null,
    features: value.features
      ? value.features.split('\n').map((s) => s.trim()).filter(Boolean)
      : null,
    academyId: value.academyId || null,
    courseId: value.courseId || null,
    seoTitle: value.seoTitle.trim() || null,
    seoDescription: value.seoDescription.trim() || null,
    thumbnailUrl: value.thumbnailUrl,
  };
}

type Relation = { id: string; slug: string; title: string };

/** Loads the academy/course pickers once for whichever form needs them. */
function useRelations() {
  const [academies, setAcademies] = useState<Relation[]>([]);
  const [courses, setCourses] = useState<Relation[]>([]);
  useEffect(() => {
    fetchWithRefresh('/api/proxy/admin/academies?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAcademies(Array.isArray(d?.items) ? d.items : []))
      .catch(() => {});
    fetchWithRefresh('/api/proxy/admin/courses?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCourses(Array.isArray(d?.items) ? d.items : []))
      .catch(() => {});
  }, []);
  return { academies, courses };
}

/**
 * Drag-and-drop image field. Uses its own hidden input ref rather than a
 * document-wide `[data-upload]` query, which previously meant a page with two
 * upload fields would have had both writing to the same file input.
 */
export function ImageUploadField({
  id,
  label,
  hint,
  previewUrl,
  onSelect,
  onClear,
  maxBytes = 25 * 1024 * 1024,
}: {
  id?: string;
  label: string;
  hint: string;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  maxBytes?: number;
}) {
  const t = useTranslations('admin.productForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const read = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: t('notAnImage', { default: 'Not an image' }) });
      return;
    }
    if (file.size > maxBytes) {
      toast({
        type: 'err',
        title: t('fileTooLarge', { default: 'File too large' }),
        description: t('maxSize', { mb: Math.round(maxBytes / 1024 / 1024), default: 'Max {mb} MB' }),
      });
      return;
    }
    // Pass the File through untouched. The previous FileReader step produced a base64
    // data URL that then had to be POSTed as JSON — a third larger than the file, and
    // rejected outright past ~1.5 MB by the API's JSON body limit.
    onSelect(file);
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-foreground">{label}</span>
      <div
        id={id}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) read(file);
        }}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed px-4 py-6 text-center transition-[background-color,border-color,transform] duration-300',
          drag
            ? 'scale-[1.01] border-primary/60 bg-primary/8'
            : previewUrl
              ? 'border-border bg-surface-sunken/50'
              : 'border-border bg-surface-sunken/50 hover:border-border-strong hover:bg-muted/60',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="max-h-40 w-full rounded-lg object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-card shadow-xs transition-transform duration-300 group-hover:-translate-y-0.5">
              <Upload className="size-4" />
            </span>
            <span className="text-xs font-medium text-foreground">
              {drag
                ? t('dropHere', { default: 'Drop to add' })
                : t('dropOrClick', { default: 'Drag & drop or click to upload' })}
            </span>
          </span>
        )}
        <span className="max-w-[40ch] text-2xs leading-relaxed text-muted-foreground">{hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) read(file);
          e.target.value = '';
        }}
      />
      {previewUrl ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium text-destructive transition hover:border-destructive/30 hover:bg-destructive/8 active:scale-[0.98]"
        >
          <X className="size-3.5" />
          {t('removeImage', { default: 'Remove image' })}
        </button>
      ) : null}
    </div>
  );
}

/** Anchors the form sections expose to `SectionNav` and to the readiness summary. */
export type ProductSectionId = 'basics' | 'pricing' | 'inventory' | 'media' | 'details' | 'arabic' | 'seo';

export interface ProductFormErrors {
  title?: string;
  price?: string;
}

/**
 * The same validation rules the create screen always had: a title, and a price that is a
 * non-negative number when one is given. Returned as messages so the form can show them
 * inline once a save has been attempted.
 */
export function validateProduct(
  value: ProductFormValue,
  t: (key: string) => string,
): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!value.title.trim()) errors.title = t('titleRequired');
  const priceText = value.priceCents.trim();
  if (priceText !== '' && (!Number.isFinite(Number(priceText)) || Number(priceText) < 0)) {
    errors.price = t('priceRequired');
  }
  return errors;
}

/** Which section an error lives in, in page order, so a failed save can scroll to the first. */
export function firstInvalidSection(errors: ProductFormErrors): ProductSectionId | null {
  if (errors.title) return 'basics';
  if (errors.price) return 'pricing';
  return null;
}

/** Items for the rail's `SectionNav`. */
export function productSectionItems(
  t: (key: string) => string,
  errors: ProductFormErrors = {},
): SectionNavItem[] {
  return [
    { id: 'basics', label: t('sectionBasics'), icon: Package, invalid: !!errors.title },
    { id: 'pricing', label: t('sectionPricingOnly'), icon: Tag, invalid: !!errors.price },
    { id: 'inventory', label: t('sectionInventory'), icon: Boxes },
    { id: 'media', label: t('sectionMediaGroup'), icon: ImageIcon },
    { id: 'details', label: t('sectionDetails'), icon: FileText },
    { id: 'arabic', label: t('arabicCopy'), icon: Languages },
    { id: 'seo', label: t('sectionSeo'), icon: Search },
  ];
}

/** Everything needed to publish, each pointing at the control that fixes it. */
export function productReadinessChecks(
  t: (key: string) => string,
  value: ProductFormValue,
): ReadinessCheck[] {
  const priced =
    value.pricingMode === 'request' ||
    (value.priceCents.trim() !== '' && Number(value.priceCents) > 0);
  return [
    { label: t('readinessTitle'), ok: !!value.title.trim(), target: 'pf-title' },
    { label: t('readinessSlug'), ok: !!value.slug.trim(), target: 'basics' },
    { label: t('readinessDescription'), ok: !!value.description.trim(), target: 'pf-description' },
    { label: t('readinessCategory'), ok: !!value.category.trim(), target: 'pf-category' },
    { label: t('readinessThumbnail'), ok: !!value.thumbnailUrl, target: 'pf-thumbnail' },
    { label: t('readinessPrice'), ok: priced, target: 'pf-price' },
  ];
}

/** Scroll to an element and, when it can take focus, focus it. */
export function jumpToField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.tabIndex >= 0) {
    el.focus({ preventScroll: true });
  }
}

function SubHeading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 border-t border-border/60 pt-5">
      <h3 className="font-display text-base font-medium tracking-[-0.01em] text-foreground">{children}</h3>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Arabic copy, plus the translate-from-English helper.
 *
 * Lives with the form so the create and edit screens share one implementation: both used to
 * carry an identical copy of this hook and its coverage maths.
 */
export function useProductArabic(
  value: ProductFormValue,
  set: <K extends keyof ProductFormValue>(
    key: K,
    next: ProductFormValue[K] | ((prev: ProductFormValue[K]) => ProductFormValue[K]),
  ) => void,
) {
  const tTranslate = useTranslations('admin.translate');

  const groups = useMemo(() => {
    const main: Record<string, string> = {
      Title: value.title,
      Tagline: value.tagline,
      Description: value.description,
      'Bullet points (one per line)': value.features,
      'SEO title': value.seoTitle,
      'SEO description': value.seoDescription,
    };
    const out: Array<{ key: string; fields: Record<string, string> }> = [{ key: 'product', fields: main }];
    for (const pin of value.pinpoints) {
      out.push({
        key: `pin:${pin.id}`,
        fields: { Label: pin.label, Tooltip: pin.tooltip ?? '', Detail: pin.detail ?? '' },
      });
    }
    return out;
  }, [value.title, value.tagline, value.description, value.features, value.seoTitle, value.seoDescription, value.pinpoints]);

  const { busy, run, coverageFor } = useTranslateDraft({
    entity: 'product copy',
    descriptors: PRODUCT_FIELDS,
    groups,
    onApply: (key, translations) => {
      set('translationsAr', (prev) => {
        if (key.startsWith('pin:')) {
          const id = key.slice('pin:'.length);
          const current = prev.hotspots?.[id] ?? { label: '', tooltip: '', detail: '' };
          return {
            ...prev,
            hotspots: {
              ...(prev.hotspots ?? {}),
              [id]: {
                label: translations['Label'] ?? current.label,
                tooltip: translations['Tooltip'] ?? current.tooltip,
                detail: translations['Detail'] ?? current.detail,
              },
            },
          };
        }
        return {
          ...prev,
          title: translations['Title'] ?? prev.title,
          tagline: translations['Tagline'] ?? prev.tagline,
          description: translations['Description'] ?? prev.description,
          features: translations['Bullet points (one per line)'] ?? prev.features,
          seoTitle: translations['SEO title'] ?? prev.seoTitle,
          seoDescription: translations['SEO description'] ?? prev.seoDescription,
        };
      });
    },
    confirmOverwrite: () => window.confirm(tTranslate('overwriteConfirm')),
  });

  const productCoverage = coverageFor(value, value.translationsAr);
  const total = useMemo<TranslationCoverage | undefined>(() => {
    if (!productCoverage) return undefined;
    // Fold hotspot strings into the product bar: leaving them out would show a product as fully
    // translated while its image pins were still English.
    let translated = productCoverage.translated;
    let count = productCoverage.total;
    const missing = [...productCoverage.missing];
    for (const pin of value.pinpoints) {
      const c = coverageOf(pin, value.translationsAr.hotspots?.[pin.id] ?? null, HOTSPOT_FIELDS);
      count += c.total;
      translated += c.translated;
      missing.push(...c.missing);
    }
    return { total: count, translated, missing, present: [] };
  }, [productCoverage, value.pinpoints, value.translationsAr.hotspots]);

  return { coverage: total, busy, run };
}

export type ProductArabic = ReturnType<typeof useProductArabic>;

/** Which rail dot each section shows. */
export function productRailSections(
  t: (key: string) => string,
  value: ProductFormValue,
  arabic: ProductArabic,
  errors: ProductFormErrors = {},
): RailSection[] {
  const priced =
    value.pricingMode === 'request' || (value.priceCents.trim() !== '' && Number(value.priceCents) > 0);
  const basicsDone = !!value.title.trim() && !!value.description.trim() && !!value.category.trim();
  const missingArabic = arabic.coverage ? arabic.coverage.total - arabic.coverage.translated : 0;
  return [
    {
      id: 'basics',
      label: t('sectionBasics'),
      state: errors.title ? 'error' : basicsDone ? (missingArabic > 0 ? 'todo' : 'done') : 'todo',
      meta: missingArabic > 0 ? `AR ${arabic.coverage!.translated}/${arabic.coverage!.total}` : undefined,
    },
    { id: 'pricing', label: t('sectionPricingOnly'), state: errors.price ? 'error' : priced ? 'done' : 'todo' },
    { id: 'inventory', label: t('sectionInventory'), state: 'idle' },
    { id: 'media', label: t('sectionMediaGroup'), state: value.thumbnailUrl ? 'done' : 'todo' },
    { id: 'details', label: t('sectionDetails'), state: value.academyId || value.courseId || value.documents.length ? 'done' : 'idle' },
    { id: 'seo', label: t('sectionSeo'), state: value.seoTitle.trim() ? 'done' : 'idle' },
  ];
}

export function ProductFormSections({
  value,
  set,
  mode = 'create',
  errors = {},
  gallery,
  arabic,
}: {
  value: ProductFormValue;
  set: <K extends keyof ProductFormValue>(
    key: K,
    next: ProductFormValue[K] | ((prev: ProductFormValue[K]) => ProductFormValue[K]),
  ) => void;
  mode?: 'create' | 'edit';
  /** Inline errors; the page decides when they become visible (after the first attempt). */
  errors?: ProductFormErrors;
  /** The gallery manager, which only exists once the product has been saved. */
  gallery?: ReactNode;
  /** Arabic coverage and the draft-from-English action, owned by the page. */
  arabic: ProductArabic;
}) {
  const t = useTranslations('admin.productForm');
  const { academies, courses } = useRelations();
  const digits = fractionDigits(value.currency);
  const unit = digits === 0 ? t('minorUnitWhole', { default: 'minor units' }) : t('minorUnit', { default: 'cents' });
  const setAr = (patch: Partial<ProductFormValue['translationsAr']>) =>
    set('translationsAr', (prev) => ({ ...prev, ...patch }));
  const draft = () => void arabic.run('missing');

  return (
    <>
      <EditorSection
        id="basics"
        title={t('sectionBasics', { default: 'Basics' })}
        hint={t('sectionBasicsDesc', { default: 'How this product appears in your catalog.' })}
        actions={
          <TranslateAction coverage={arabic.coverage} busy={arabic.busy} onTranslate={(scope) => void arabic.run(scope)} />
        }
      >
        <BilingualField
          id="pf-title"
          label={t('fieldTitle', { default: 'Title' })}
          required
          error={errors.title}
          en={{
            value: value.title,
            onChange: (next) => set('title', next),
            placeholder: t('titlePlaceholder', { default: 'e.g. Beginner End Mill Kit' }),
            autoFocus: mode === 'create',
          }}
          ar={{ value: value.translationsAr.title, onChange: (next) => setAr({ title: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
        <SlugField
          label={t('fieldSlug', { default: 'Slug' })}
          value={value.slug}
          onChange={(next) => set('slug', next)}
          prefix="/products/"
          source={mode === 'create' ? value.title : undefined}
          mode={mode}
        />
        <BilingualField
          id="pf-tagline"
          label={t('fieldTagline', { default: 'Tagline' })}
          en={{
            value: value.tagline,
            onChange: (next) => set('tagline', next),
            placeholder: t('taglinePlaceholder', { default: 'Short subtitle' }),
          }}
          ar={{ value: value.translationsAr.tagline, onChange: (next) => setAr({ tagline: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
        <BilingualField
          id="pf-description"
          label={t('fieldDescription', { default: 'Description' })}
          multiline
          rows={5}
          en={{ value: value.description, onChange: (next) => set('description', next) }}
          ar={{ value: value.translationsAr.description, onChange: (next) => setAr({ description: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
        <BilingualField
          id="pf-features"
          label={t('fieldFeatures', { default: 'Features' })}
          hint={t('fieldFeaturesHint', { default: 'One per line.' })}
          multiline
          rows={3}
          en={{ value: value.features, onChange: (next) => set('features', next) }}
          ar={{ value: value.translationsAr.features, onChange: (next) => setAr({ features: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
        <FieldGrid cols={3}>
          <TextField
            id="pf-category"
            label={t('fieldCategory', { default: 'Category' })}
            value={value.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder={t('categoryPlaceholder', { default: 'e.g. Tool Kits, Workholding' })}
          />
          <TextField
            label={t('fieldProductType', { default: 'Product type' })}
            value={value.productType}
            onChange={(e) => set('productType', e.target.value)}
            placeholder={t('productTypePlaceholder', { default: 'e.g. Vertical Machining Center, Collet Systems' })}
          />
          <TextField
            label={t('fieldTags', { default: 'Tags' })}
            hint={t('fieldTagsHint', { default: 'Comma separated.' })}
            value={value.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="milling, endmill, starter"
          />
        </FieldGrid>
      </EditorSection>

      <EditorSection id="pricing" title={t('sectionPricingOnly')} hint={t('sectionPricingOnlyDesc')}>
        {/*
          Pricing mode decides what the storefront shows and whether the cart is even
          reachable, so it is the first choice in the section, as three cards rather
          than a select whose options nobody opens.
        */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-13 font-medium text-foreground">
            {t('fieldPricingMode', { default: 'Pricing' })}
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {(
              [
                ['fixed', t('pricingFixed', { default: 'Fixed price' })],
                ['from', t('pricingFrom', { default: 'From a price' })],
                ['request', t('pricingRequest', { default: 'Request a quote' })],
              ] as const
            ).map(([mode, label]) => (
              <label
                key={mode}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm transition',
                  value.pricingMode === mode
                    ? 'border-primary bg-primary/5 font-medium text-foreground ring-1 ring-primary'
                    : 'border-border text-foreground/90 hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="pf-pricing-mode"
                  checked={value.pricingMode === mode}
                  onChange={() => set('pricingMode', mode)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {value.pricingMode === 'request' ? (
          <p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            {t('pricingRequestExplain', {
              default:
                'No price is shown and customers send a quote request instead of adding to the cart. Any price left below is kept but not displayed.',
            })}
          </p>
        ) : null}
        <FieldGrid cols={3}>
          <TextField
            id="pf-price"
            label={t('fieldPriceOptional')}
            type="number"
            min={0}
            inputMode="numeric"
            dir="ltr"
            value={value.priceCents}
            onChange={(e) => set('priceCents', e.target.value)}
            error={errors.price}
            hint={
              value.pricingMode === 'from'
                ? t('fieldPriceHintFrom', {
                    unit,
                    default: 'Used as the base. “From” is computed from the lowest option price across variants.',
                  })
                : t('fieldPriceHint', { unit, default: 'Stored in {unit}.' })
            }
          />
          <TextField
            label={t('fieldCompareAt', { default: 'Compare-at price' })}
            type="number"
            min={0}
            inputMode="numeric"
            dir="ltr"
            value={value.compareAtCents}
            onChange={(e) => set('compareAtCents', e.target.value)}
            hint={t('fieldCompareAtHint', { default: 'Shown struck through to signal a discount.' })}
            error={
              value.compareAtCents && Number(value.compareAtCents) <= Number(value.priceCents)
                ? t('compareAtTooLow', { default: 'Must be higher than the price to show a discount.' })
                : undefined
            }
          />
          <SelectField
            label={t('fieldCurrency', { default: 'Currency' })}
            value={value.currency}
            onChange={(e) => set('currency', e.target.value)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </SelectField>
        </FieldGrid>
      </EditorSection>

      <EditorSection id="inventory" title={t('sectionInventory')} hint={t('sectionInventoryDesc')}>
        <FieldGrid>
          <TextField
            label={t('fieldInventory', { default: 'Inventory' })}
            type="number"
            min={0}
            inputMode="numeric"
            dir="ltr"
            disabled={!value.trackInventory}
            value={value.inventory}
            onChange={(e) => set('inventory', e.target.value)}
          />
          <TextField
            label={t('fieldSortOrder', { default: 'Sort order' })}
            type="number"
            inputMode="numeric"
            dir="ltr"
            value={value.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            hint={t('fieldSortOrderHint', { default: 'Lower numbers appear first.' })}
          />
        </FieldGrid>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SwitchField
            label={t('trackInventory', { default: 'Track inventory' })}
            description={t('trackInventoryDesc', { default: 'Decrease stock as orders are placed.' })}
            checked={value.trackInventory}
            onCheckedChange={(v) => set('trackInventory', v)}
          />
          <SwitchField
            label={t('allowBackorder', { default: 'Allow backorder' })}
            description={t('allowBackorderDesc', { default: 'Keep selling when stock reaches zero.' })}
            checked={value.allowBackorder}
            onCheckedChange={(v) => set('allowBackorder', v)}
          />
          <SwitchField
            label={t('isDigital', { default: 'Digital product' })}
            description={t('isDigitalDesc', { default: 'No shipping required after checkout.' })}
            checked={value.isDigital}
            onCheckedChange={(v) => set('isDigital', v)}
          />
          <SwitchField
            label={t('featured', { default: 'Featured' })}
            description={t('featuredDesc', { default: 'Highlight this product in the storefront.' })}
            checked={value.featured}
            onCheckedChange={(v) => set('featured', v)}
          />
        </div>
      </EditorSection>

      <EditorSection id="media" title={t('sectionMediaGroup')} hint={t('sectionMediaGroupDesc')}>
        <ImageUploadField
          id="pf-thumbnail"
          label={t('fieldThumbnail', { default: 'Product thumbnail' })}
          hint={t('thumbnailHint', { default: 'Square recommended · JPG, PNG, WebP, AVIF · up to 25 MB' })}
          previewUrl={value.thumbnailUrl}
          onSelect={(file) => {
            uploadImage(file, 'covers')
              .then(({ url }) => set('thumbnailUrl', url))
              .catch((e) =>
                toast({ type: 'err', title: t('uploadFailed'), description: e instanceof Error ? e.message : undefined }),
              );
          }}
          onClear={() => set('thumbnailUrl', null)}
        />
        <SubHeading hint={gallery ? t('galleryHint') : t('galleryAfterCreate')}>
          {t('galleryTitle', { default: 'Gallery' })}
        </SubHeading>
        {gallery ?? null}
        <SubHeading hint={t('sectionHotspotsDesc')}>{t('sectionHotspots')}</SubHeading>
        <ProductHotspotsEditor
          imageUrl={value.thumbnailUrl}
          pinpoints={value.pinpoints}
          onChange={(next) => set('pinpoints', next)}
        />
      </EditorSection>

      <EditorSection id="details" title={t('sectionDetails')} hint={t('sectionDetailsDesc')}>
        <FieldGrid>
          <SelectField
            label={t('fieldAcademy', { default: 'Academy' })}
            value={value.academyId}
            onChange={(e) => set('academyId', e.target.value)}
          >
            <option value="">{t('none', { default: 'None' })}</option>
            {academies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('fieldCourse', { default: 'Course' })}
            value={value.courseId}
            onChange={(e) => set('courseId', e.target.value)}
          >
            <option value="">{t('none', { default: 'None' })}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </SelectField>
        </FieldGrid>
        <p className="-mt-2 text-xs text-muted-foreground">
          {t('sectionRelationsDesc', { default: 'Optionally surface this product inside an academy or course.' })}
        </p>
        <SubHeading hint={t('sectionDocsDesc')}>{t('sectionDocs')}</SubHeading>
        <ProductDocumentsField documents={value.documents} onChange={(next) => set('documents', next)} />
      </EditorSection>

      <EditorSection
        id="seo"
        title={t('sectionSeo', { default: 'SEO' })}
        hint={t('sectionSeoDesc', { default: 'Overrides for search results. Leave blank to use the title and description above.' })}
      >
        <SearchPreview
          title={value.seoTitle.trim() || value.title.trim()}
          description={value.seoDescription.trim() || value.description.trim()}
          path={`products/${value.slug || slugify(value.title)}`}
        />
        <BilingualField
          id="pf-seo-title"
          label={t('fieldSeoTitle', { default: 'SEO title' })}
          en={{
            value: value.seoTitle,
            onChange: (next) => set('seoTitle', next),
            placeholder: t('seoTitlePlaceholder', { default: 'Custom title for search results' }),
          }}
          ar={{ value: value.translationsAr.seoTitle, onChange: (next) => setAr({ seoTitle: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
        <BilingualField
          id="pf-seo-description"
          label={t('fieldSeoDescription', { default: 'SEO description' })}
          multiline
          rows={3}
          en={{
            value: value.seoDescription,
            onChange: (next) => set('seoDescription', next),
            placeholder: t('seoDescriptionPlaceholder', { default: 'Meta description for search' }),
          }}
          ar={{ value: value.translationsAr.seoDescription, onChange: (next) => setAr({ seoDescription: next }) }}
          onDraftArabic={draft}
          drafting={arabic.busy}
        />
      </EditorSection>
    </>
  );
}

/** How the page reads in a search result, filled from the copy until overridden. */
function SearchPreview({ title, description, path }: { title: string; description: string; path: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/70 bg-background p-4" dir="ltr">
      <span className="truncate text-xs text-success">{`barootcnc.com › ${path.replace(/\//g, ' › ')}`}</span>
      <span className="truncate text-lg leading-snug text-info">{title || '—'}</span>
      <span className="line-clamp-2 text-13 leading-relaxed text-muted-foreground">{description || '—'}</span>
    </div>
  );
}

/**
 * The product as a store card, in the language the editor is looking at.
 * Arabic falls back to English field by field, exactly as the storefront does.
 */
export function ProductCardPreview({ value }: { value: ProductFormValue }) {
  const t = useTranslations('admin.productForm');
  const { mode } = useLanguageMode();
  const ar = mode === 'ar';
  const title = (ar && value.translationsAr.title.trim()) || value.title.trim() || t('untitled', { default: 'Untitled product' });
  const tagline = (ar && value.translationsAr.tagline.trim()) || value.tagline.trim();
  const price = value.priceCents.trim() ? Number(value.priceCents) : null;
  const compare = value.compareAtCents.trim() ? Number(value.compareAtCents) : null;
  const fmt = (minor: number) => {
    try {
      return new Intl.NumberFormat(ar ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: isCurrencyCode(value.currency) ? value.currency : 'SAR',
        maximumFractionDigits: fractionDigits(value.currency),
      }).format(minor / 10 ** fractionDigits(value.currency));
    } catch {
      return String(minor);
    }
  };
  const off = price && compare && compare > price ? Math.round((1 - price / compare) * 100) : null;
  return (
    <div dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'en'} className="overflow-hidden rounded-2xl border border-border/70 bg-background">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">
        {value.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImageIcon className="size-6" aria-hidden="true" />
        )}
        {off ? (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground">
            −{off}%
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        {value.category.trim() && <span className="text-2xs text-muted-foreground">{value.category}</span>}
        <span className={cn('text-base leading-snug text-foreground', !ar && 'font-display')}>{title}</span>
        {tagline && <span className="text-13 text-muted-foreground">{tagline}</span>}
        <div className="mt-1 flex items-baseline gap-2">
          {value.pricingMode === 'request' ? (
            <span className="text-sm font-medium text-foreground">{t('pricingRequest', { default: 'Request a quote' })}</span>
          ) : price !== null ? (
            <>
              <span className="text-[0.9375rem] font-semibold tabular-nums text-foreground">
                {value.pricingMode === 'from' ? `${t('fromPrefix', { default: 'From' })} ` : ''}
                {fmt(price)}
              </span>
              {off ? <span className="text-xs tabular-nums text-muted-foreground line-through">{fmt(compare!)}</span> : null}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

export { ErrorBanner, isCurrencyCode };

export function ProductHotspotsEditor({
  imageUrl,
  pinpoints,
  onChange,
}: {
  imageUrl: string | null | undefined;
  pinpoints: InteractiveHotspot[];
  onChange: (next: InteractiveHotspot[]) => void;
}) {
  const t = useTranslations('admin.productForm');
  const [placing, setPlacing] = useState(false);

  const place = (x: number, y: number) => {
    const id = makeId('pinpoint');
    onChange([...pinpoints, { id, x, y, label: `Point ${pinpoints.length + 1}`, tooltip: null, detail: null }]);
    setPlacing(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          {t('hotspotPlace')}
        </p>
        <button
          type="button"
          onClick={() => {
            // No thumbnail yet: say so instead of rendering a button that silently
            // does nothing, which is what a disabled control looks like.
            if (!imageUrl) {
              toast({ type: 'err', title: t('hotspotNeedsImage') });
              return;
            }
            setPlacing((v) => !v);
          }}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]',
            placing ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-card text-foreground shadow-xs hover:bg-muted',
          )}
        >
          {placing ? t('cancel') : t('placeHotspot')}
        </button>
      </div>
      {imageUrl ? (
        <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-border/70 bg-surface-sunken align-top">
          <img src={imageUrl} alt="" className="block max-h-96 max-w-full object-contain" />
          <AnimatePresence>
          {placing && (
            <m.button
              key="placing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: transition.crossfade }}
              exit={{ opacity: 0, transition: transition.leave }}
              type="button"
              aria-label={t('clickToPlaceHotspot')}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
                const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
                place(Number(x.toFixed(2)), Number(y.toFixed(2)));
              }}
              className="absolute inset-0 cursor-crosshair bg-primary/10"
            />
          )}
          </AnimatePresence>
          {pinpoints.map((p, index) => (
            <span
              key={p.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <m.button
                type="button"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                whileHover={{ scale: 1.1 }}
                className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary/90 text-xs font-medium text-primary-foreground shadow-lg"
                aria-label={t('hotspotNumber', { number: index + 1 })}
              >
                {index + 1}
              </m.button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('hotspotNeedsImage')}
        </p>
      )}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
        {pinpoints.map((p, index) => (
          <m.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: spring.smooth }}
            exit={{ opacity: 0, scale: 0.98, transition: transition.leave }}
            className="space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                {t('hotspotNumber', { number: index + 1 })} · <span dir="ltr">{Math.round(p.x)}%, {Math.round(p.y)}%</span>
              </p>
              <button
                type="button"
                onClick={() => onChange(pinpoints.filter((x) => x.id !== p.id))}
                className="rounded-lg border border-border/70 px-2 py-1 text-xs font-medium text-destructive transition hover:border-destructive/30 hover:bg-destructive/8"
              >
                {t('removeDocument')}
              </button>
            </div>
            <TextInput
              value={p.label}
              placeholder={t('hotspotLabel')}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
            />
            <TextInput
              value={p.tooltip ?? ''}
              placeholder={t('hotspotTooltip')}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, tooltip: e.target.value || null } : x)))}
            />
            <TextArea
              value={p.detail ?? ''}
              placeholder={t('hotspotDetail')}
              rows={2}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, detail: e.target.value || null } : x)))}
            />
          </m.div>
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ProductDocumentsField({
  documents,
  onChange,
}: {
  documents: ProductDocument[];
  onChange: (next: ProductDocument[]) => void;
}) {
  const t = useTranslations('admin.productForm');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addPdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({ type: 'err', title: t('pdfOnly'), description: t('pdfOnlyHint') });
      return;
    }
    setUploading(true);
    try {
      // A manual is often several MB; the base64 JSON path could not carry one.
      const data = await uploadFileToStorage(file, 'attachments');
      onChange([...documents, { title: file.name, url: data.url, name: file.name, size: file.size }]);
      toast({ type: 'ok', title: t('pdfAttached', { default: 'PDF attached' }) });
    } catch (e) {
      toast({ type: 'err', title: t('uploadFailed', { default: 'Upload failed' }), description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
      >
        {uploading ? t('uploading', { default: 'Uploading…' }) : t('attachPdf', { default: '+ Attach PDF' })}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addPdf(file);
          e.target.value = '';
        }}
      />
      <div className="space-y-2">
        <AnimatePresence initial={false}>
        {documents.map((doc, index) => (
          <m.div
            key={`${doc.url}-${index}`}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: spring.smooth }}
            exit={{ opacity: 0, transition: transition.leave }}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs"
          >
            <TextInput
              value={doc.title}
              onChange={(e) => onChange(documents.map((d, i) => (i === index ? { ...d, title: e.target.value } : d)))}
              placeholder={t('documentTitle', { default: 'Document title' })}
              className="min-w-0 flex-1"
            />
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/8"
            >
              {t('viewDocument', { default: 'View' })}
            </a>
            <button
              type="button"
              onClick={() => onChange(documents.filter((_, i) => i !== index))}
              className="shrink-0 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-destructive transition hover:border-destructive/30 hover:bg-destructive/8"
            >
              {t('removeDocument', { default: 'Remove' })}
            </button>
          </m.div>
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export interface ReadinessCheck {
  label: string;
  ok: boolean;
  /** Element id (a field) or section id to jump to when this item is outstanding. */
  target: string;
}

/**
 * Compact publish-readiness summary. Complete items collapse into the count; each missing
 * item is a button that takes the author straight to the control that fixes it.
 */
export function PublishReadiness({ checks, className }: { checks: ReadinessCheck[]; className?: string }) {
  const t = useTranslations('admin.productForm');
  const ready = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok);
  const done = missing.length === 0;

  return (
    <div className={cn('rounded-xl border border-border/70 bg-card p-3.5 shadow-xs', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-13 font-medium text-foreground">{t('publishReadiness')}</p>
        <span
          className={cn(
            'inline-flex items-center gap-2 font-mono text-xs tabular-nums',
            done ? 'text-success' : 'text-muted-foreground',
          )}
          dir="ltr"
        >
          {/* One segment per check, so an incomplete list shows which requirement is still
              outstanding rather than a bar that only says "somewhere short". */}
          <span className="inline-flex items-center gap-[3px]" aria-hidden>
            {checks.map((check, index) => (
              <m.span
                key={index}
                initial={false}
                animate={{ scaleY: check.ok ? 1 : 0.7 }}
                transition={spring.snappy}
                className={cn(
                  'block h-1.5 w-2.5 rounded-full transition-colors duration-300',
                  check.ok ? 'bg-success' : 'bg-warning/60',
                )}
              />
            ))}
          </span>
          {ready}/{checks.length}
        </span>
      </div>
      {done ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" />
          {t('readinessReady')}
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{t('readinessFix')}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((check) => (
              <li key={check.target}>
                <button
                  type="button"
                  onClick={() => jumpToField(check.target)}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/15"
                >
                  {check.label}
                  <ArrowRight className="size-3 rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
