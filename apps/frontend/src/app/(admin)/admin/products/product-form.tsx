'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Link2, Package, Search, Store, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode, type InteractiveHotspot } from '@titan/shared';
import {
  Field,
  FieldGrid,
  FormSection,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/admin/admin-form';
import { ErrorBanner } from '@/components/admin/admin-ui';
import { makeId } from '@/lib/lesson-blocks';
import { uploadFileToStorage, uploadImage } from '@/lib/upload';
import { toast } from '@/components/ui/toast';

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
  const set = <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) =>
    setValue((v) => ({ ...v, [key]: next }));
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
    fetch('/api/proxy/admin/academies?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAcademies(Array.isArray(d?.items) ? d.items : []))
      .catch(() => {});
    fetch('/api/proxy/admin/courses?limit=100', { credentials: 'include' })
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
  label,
  hint,
  previewUrl,
  onSelect,
  onClear,
  maxBytes = 25 * 1024 * 1024,
}: {
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

export function ProductFormSections({
  value,
  set,
  columns = 1,
}: {
  value: ProductFormValue;
  set: <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) => void;
  /**
   * Two columns on wide screens, for the create page.
   *
   * These seven sections vary a lot in height, so they are flowed with CSS columns and
   * `break-inside-avoid` rather than a grid: a grid forces every row to the height of its
   * tallest cell, which left the short SEO card next to a tall pricing card and read as a
   * layout mistake. Flowing keeps the natural order top-to-bottom and packs the cards.
   */
  columns?: 1 | 2;
}) {
  const t = useTranslations('admin.productForm');
  const { academies, courses } = useRelations();
  const digits = fractionDigits(value.currency);
  const unit = digits === 0 ? t('minorUnitWhole', { default: 'minor units' }) : t('minorUnit', { default: 'cents' });

  const sectionClass = columns === 2 ? 'mb-4 break-inside-avoid' : undefined;

  return (
    <div className={columns === 2 ? 'columns-1 gap-4 lg:columns-2' : 'space-y-5'}>
      <FormSection
        className={sectionClass}
        title={t('sectionBasics', { default: 'Basics' })}
        icon={Package}
        description={t('sectionBasicsDesc', { default: 'How this product appears in your catalog.' })}
      >
        <FieldGrid>
          <TextField
            label={t('fieldTitle', { default: 'Title' })}
            required
            value={value.title}
            onChange={(e) => {
              set('title', e.target.value);
              // Keep the slug in step until it is edited deliberately.
              if (!value.slug || value.slug === slugify(value.title)) set('slug', slugify(e.target.value));
            }}
            placeholder={t('titlePlaceholder', { default: 'e.g. Beginner End Mill Kit' })}
          />
          <Field
            label={t('fieldSlug', { default: 'Slug' })}
            hint={t('fieldSlugHint', { default: 'The public URL segment for this product.' })}
          >
            {(a) => (
              <TextInputMono
                {...a}
                value={value.slug || slugify(value.title)}
                onChange={(e) => set('slug', e.target.value)}
              />
            )}
          </Field>
        </FieldGrid>
        <div className="mt-4 space-y-4">
          <TextField
            label={t('fieldTagline', { default: 'Tagline' })}
            value={value.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder={t('taglinePlaceholder', { default: 'Short subtitle' })}
          />
          <TextAreaField
            label={t('fieldDescription', { default: 'Description' })}
            rows={5}
            value={value.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <FieldGrid>
            <TextField
              label={t('fieldCategory', { default: 'Category' })}
              value={value.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder={t('categoryPlaceholder', { default: 'e.g. Tool Kits, Workholding' })}
            />
            <TextField
              label={t('fieldProductType', { default: 'Product type' })}
              hint={t('fieldProductTypeHint', {
                default: 'The kind of product within the category, e.g. Vertical Machining Center.',
              })}
              value={value.productType}
              onChange={(e) => set('productType', e.target.value)}
              placeholder={t('productTypePlaceholder', {
                default: 'e.g. Vertical Machining Center, Collet Systems',
              })}
            />
          </FieldGrid>
          <TextField
            label={t('fieldTags', { default: 'Tags' })}
            hint={t('fieldTagsHint', { default: 'Comma separated.' })}
            value={value.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="milling, endmill, starter"
          />
          <TextAreaField
            label={t('fieldFeatures', { default: 'Features' })}
            hint={t('fieldFeaturesHint', { default: 'One per line.' })}
            rows={3}
            value={value.features}
            onChange={(e) => set('features', e.target.value)}
          />
        </div>
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionPricing', { default: 'Pricing & inventory' })}
        icon={Store}
        description={t('sectionPricingDesc', { default: 'Set the price customers pay and how stock behaves.' })}
      >
        {/*
          Pricing mode decides what the storefront shows and whether the cart is even
          reachable, so it sits above the price field rather than being buried beside it.
        */}
        <FieldGrid>
          <SelectField
            label={t('fieldPricingMode', { default: 'Pricing' })}
            value={value.pricingMode}
            onChange={(e) => set('pricingMode', e.target.value as 'fixed' | 'from' | 'request')}
            hint={t('pricingModeHint', { default: 'How this product is priced on the storefront.' })}
          >
            <option value="fixed">{t('pricingFixed', { default: 'Fixed price' })}</option>
            <option value="from">{t('pricingFrom', { default: 'From a price' })}</option>
            <option value="request">{t('pricingRequest', { default: 'Request a quote' })}</option>
          </SelectField>
        </FieldGrid>

        {value.pricingMode === 'request' ? (
          <p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            {t('pricingRequestExplain', {
              default:
                'No price is shown and customers send a quote request instead of adding to the cart. Any price left below is kept but not displayed.',
            })}
          </p>
        ) : null}

        <FieldGrid>
          <TextField
            label={t('fieldPriceOptional')}
            type="number"
            min={0}
            inputMode="numeric"
            value={value.priceCents}
            onChange={(e) => set('priceCents', e.target.value)}
            hint={
              value.pricingMode === 'from'
                ? t('fieldPriceHintFrom', {
                    unit,
                    default:
                      'Used as the base. “From” is computed from the lowest option price across variants.',
                  })
                : t('fieldPriceHint', { unit, default: 'Stored in {unit}.' })
            }
          />
          <TextField
            label={t('fieldCompareAt', { default: 'Compare-at price' })}
            type="number"
            min={0}
            inputMode="numeric"
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
          <TextField
            label={t('fieldInventory', { default: 'Inventory' })}
            type="number"
            min={0}
            inputMode="numeric"
            disabled={!value.trackInventory}
            value={value.inventory}
            onChange={(e) => set('inventory', e.target.value)}
          />
          <TextField
            label={t('fieldSortOrder', { default: 'Sort order' })}
            type="number"
            inputMode="numeric"
            value={value.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            hint={t('fieldSortOrderHint', { default: 'Lower numbers appear first.' })}
          />
        </FieldGrid>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionRelations', { default: 'Relations' })}
        icon={Link2}
        description={t('sectionRelationsDesc', { default: 'Optionally surface this product inside an academy or course.' })}
      >
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
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionSeo', { default: 'SEO' })}
        icon={Search}
        description={t('sectionSeoDesc', { default: 'Overrides for search results. Leave blank to use the title and description above.' })}
      >
        <FieldGrid>
          <TextField
            label={t('fieldSeoTitle', { default: 'SEO title' })}
            value={value.seoTitle}
            onChange={(e) => set('seoTitle', e.target.value)}
            placeholder={t('seoTitlePlaceholder', { default: 'Custom title for search results' })}
          />
          <TextAreaField
            label={t('fieldSeoDescription', { default: 'SEO description' })}
            rows={3}
            value={value.seoDescription}
            onChange={(e) => set('seoDescription', e.target.value)}
            placeholder={t('seoDescriptionPlaceholder', { default: 'Meta description for search' })}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionMedia', { default: 'Thumbnail' })}
        icon={ImageIcon}
        description={t('sectionMediaDesc', { default: 'Shown in catalog listings and the storefront.' })}
      >
        <ImageUploadField
          label={t('fieldThumbnail', { default: 'Product thumbnail' })}
          hint={t('thumbnailHint', { default: 'Square recommended · JPG, PNG, WebP, AVIF · up to 25 MB' })}
          previewUrl={value.thumbnailUrl}
          onSelect={(file) => {
            uploadImage(file, 'covers')
              .then(({ url }) => set('thumbnailUrl', url))
              .catch((e) =>
                toast({ type: 'err', title: 'Upload failed', description: e instanceof Error ? e.message : undefined }),
              );
          }}
          onClear={() => set('thumbnailUrl', null)}
        />
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionHotspots')}
        icon={ImageIcon}
        description={t('sectionHotspotsDesc')}
      >
        <ProductHotspotsEditor
          imageUrl={value.thumbnailUrl}
          pinpoints={value.pinpoints}
          onChange={(next) => set('pinpoints', next)}
        />
      </FormSection>

      <FormSection
        className={sectionClass}
        title={t('sectionDocs')}
        icon={ImageIcon}
        description={t('sectionDocsDesc')}
      >
        <ProductDocumentsField
          documents={value.documents}
          onChange={(next) => set('documents', next)}
        />
      </FormSection>
    </div>
  );
}

/**
 * Monospace variant used for slug inputs. It receives the same props as the
 * other controls, so `invalid` has to be consumed rather than forwarded — it is
 * not a DOM attribute and React warns when it reaches the element.
 */
function TextInputMono({
  className,
  invalid: _invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-border/80 bg-surface-sunken px-3 py-2 font-mono text-sm text-muted-foreground outline-none transition',
        'hover:border-border-strong focus:border-primary/60 focus:ring-4 focus:ring-primary/10',
        _invalid && 'border-destructive',
        className,
      )}
    />
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
          <img src={imageUrl} alt="Product" className="block max-h-96 max-w-full object-contain" />
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
                Point {index + 1} · {Math.round(p.x)}%, {Math.round(p.y)}%
              </p>
              <button
                type="button"
                onClick={() => onChange(pinpoints.filter((x) => x.id !== p.id))}
                className="rounded-lg border border-border/70 px-2 py-1 text-xs font-medium text-destructive transition hover:border-destructive/30 hover:bg-destructive/8"
              >
                Remove
              </button>
            </div>
            <input
              value={p.label}
              placeholder={t('hotspotLabel')}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
            <input
              value={p.tooltip ?? ''}
              placeholder={t('hotspotTooltip')}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, tooltip: e.target.value || null } : x)))}
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
            <textarea
              value={p.detail ?? ''}
              placeholder={t('hotspotDetail')}
              rows={2}
              onChange={(e) => onChange(pinpoints.map((x) => (x.id === p.id ? { ...x, detail: e.target.value || null } : x)))}
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
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
            <input
              value={doc.title}
              onChange={(e) => onChange(documents.map((d, i) => (i === index ? { ...d, title: e.target.value } : d)))}
              placeholder={t('documentTitle', { default: 'Document title' })}
              className="min-w-0 flex-1 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
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

export function PublishReadiness({
  checks,
}: {
  checks: { label: string; ok: boolean }[];
}) {
  const t = useTranslations('admin.productForm');
  const ready = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const done = missing.length === 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-medium tracking-[-0.01em] text-foreground">{t('publishReadiness')}</p>
        <span className={cn(
          'inline-flex items-center gap-2 font-mono text-xs tabular-nums',
          done ? 'text-success' : 'text-muted-foreground',
        )}>
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
      <AnimatePresence mode="wait" initial={false}>
        <m.p
          key={done ? 'done' : missing.join('|')}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: transition.enter }}
          exit={{ opacity: 0, transition: transition.leave }}
          className={cn('mt-2 text-xs', done ? 'text-success' : 'text-muted-foreground')}
        >
          {done
            ? t('readinessReady')
            : t('readinessMissing', { items: missing.join(' · ') })}
        </m.p>
      </AnimatePresence>
    </div>
  );
}
