'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Link2, Package, Search, Store, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@titan/shared';
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
  category: string;
  priceCents: string;
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

export function useProductForm(initial?: Partial<ProductFormValue>) {
  const [value, setValue] = useState<ProductFormValue>({
    title: '',
    slug: '',
    tagline: '',
    description: '',
    category: '',
    priceCents: '',
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
    ...initial,
  });
  const set = <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) =>
    setValue((v) => ({ ...v, [key]: next }));
  /** Replace the whole form, used by "discard changes". */
  const reset = useCallback((next: ProductFormValue) => setValue(next), []);
  return { value, set, reset, setValue };
}

export function productFormPayload(value: ProductFormValue) {
  return {
    title: value.title.trim(),
    slug: value.slug.trim() || slugify(value.title),
    tagline: value.tagline.trim() || null,
    description: value.description.trim() || null,
    category: value.category.trim() || null,
    price: Math.round(Number(value.priceCents) || 0),
    compareAtPrice: value.compareAtCents ? Math.round(Number(value.compareAtCents)) : null,
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
  maxBytes = 10 * 1024 * 1024,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  onSelect: (dataUrl: string) => void;
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
    const reader = new FileReader();
    reader.onload = () => onSelect(String(reader.result ?? ''));
    reader.onerror = () =>
      toast({ type: 'err', title: t('unreadable', { default: 'Could not read file' }) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-foreground">{label}</span>
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
          'flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed px-4 py-6 text-center transition',
          drag
            ? 'border-primary bg-primary/8'
            : previewUrl
              ? 'border-border bg-muted/40'
              : 'border-border bg-muted/30 hover:border-border-strong hover:bg-muted/60',
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="max-h-40 w-full rounded-lg object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
              <Upload className="size-4" />
            </span>
            <span className="text-xs font-semibold text-foreground">
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/8"
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
}: {
  value: ProductFormValue;
  set: <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) => void;
}) {
  const t = useTranslations('admin.productForm');
  const { academies, courses } = useRelations();
  const digits = fractionDigits(value.currency);
  const unit = digits === 0 ? t('minorUnitWhole', { default: 'minor units' }) : t('minorUnit', { default: 'cents' });

  return (
    <>
      <FormSection
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
              label={t('fieldTags', { default: 'Tags' })}
              hint={t('fieldTagsHint', { default: 'Comma separated.' })}
              value={value.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="milling, endmill, starter"
            />
          </FieldGrid>
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
        title={t('sectionPricing', { default: 'Pricing & inventory' })}
        icon={Store}
        description={t('sectionPricingDesc', { default: 'Set the price customers pay and how stock behaves.' })}
      >
        <FieldGrid>
          <TextField
            label={t('fieldPrice', { default: 'Price' })}
            required
            type="number"
            min={0}
            inputMode="numeric"
            value={value.priceCents}
            onChange={(e) => set('priceCents', e.target.value)}
            hint={t('fieldPriceHint', { unit, default: 'Stored in {unit}.' })}
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
        title={t('sectionMedia', { default: 'Thumbnail' })}
        icon={ImageIcon}
        description={t('sectionMediaDesc', { default: 'Shown in catalog listings and the storefront.' })}
      >
        <ImageUploadField
          label={t('fieldThumbnail', { default: 'Product thumbnail' })}
          hint={t('thumbnailHint', { default: 'Square recommended · JPG, PNG, WebP, AVIF · up to 10 MB' })}
          previewUrl={value.thumbnailUrl}
          onSelect={(dataUrl) => set('thumbnailUrl', dataUrl)}
          onClear={() => set('thumbnailUrl', null)}
        />
      </FormSection>
    </>
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
        'w-full rounded-xl border border-border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground outline-none transition',
        'hover:border-border-strong focus:border-primary/60 focus:ring-4 focus:ring-primary/10',
        _invalid && 'border-destructive',
        className,
      )}
    />
  );
}

export { ErrorBanner, isCurrencyCode };
