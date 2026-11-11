'use client';
import { useCallback, useId, useRef, useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, BookOpen, GraduationCap, ImagePlus, Loader2, Pipette, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { toast } from '@/components/ui/toast';
import { useLanguageMode } from '@/components/admin/editor/editor-kit';

/* -----------------------------------------------------------------------------
 * The look of an academy: hero banner, logo, accent colour, and the card the
 * academies page shows. Images are upload-only (the API rejects URLs) and save
 * the moment they are added, independent of the form's draft/save cycle.
 * --------------------------------------------------------------------------- */

export type AcademyImageKind = 'hero' | 'logo' | 'seo';

/** Only a well-formed 6-digit hex may be applied to a colour input or preview. */
export const HEX = /^#[0-9a-fA-F]{6}$/;
export const BRAND_CLAY = '#B65433';
const ACCENT_PRESETS = ['#B65433', '#4D6E58', '#141413', '#7A5C3E', '#3F6F8A', '#8A4B6B'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** WCAG contrast ratio of white text on `hex`, or null for an invalid colour. */
export function contrastWithWhite(hex: string): number | null {
  if (!HEX.test(hex)) return null;
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/** Upload or remove one academy image through `/admin/academies/:slug/images`. */
function useAcademyImage({
  slug,
  kind,
  label,
  onChanged,
  onUploadStart,
  onUploadEnd,
}: {
  slug: string;
  kind: AcademyImageKind;
  label: string;
  onChanged: () => void | Promise<void>;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const upload = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast({ type: 'err', title: t('notAnImage'), description: t('notAnImageHint') });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({ type: 'err', title: t('fileTooLarge'), description: t('fileTooLargeHint') });
        return;
      }
      setUploading(true);
      onUploadStart?.();
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await api.post(`/admin/academies/${slug}/images`, { kind, image: dataUrl, filename: file.name });
        toast({ type: 'ok', title: t('uploaded', { label }) });
        await onChanged();
      } catch (error) {
        toast({ type: 'err', title: t('uploadFailed'), description: messageOf(error) });
      } finally {
        setUploading(false);
        onUploadEnd?.();
      }
    },
    [slug, kind, label, onChanged, onUploadStart, onUploadEnd, t],
  );

  const remove = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/academies/${slug}/images/${kind}`);
      toast({ type: 'ok', title: t('removed', { label }) });
      await onChanged();
    } catch (error) {
      toast({ type: 'err', title: t('removeFailed'), description: messageOf(error) });
    } finally {
      setDeleting(false);
    }
  }, [slug, kind, label, onChanged, t]);

  return { upload, remove, uploading, deleting, busy: uploading || deleting };
}

function dropHandlers(onFile: (file?: File | null) => void, setDrag: (v: boolean) => void) {
  return {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      onFile(e.dataTransfer.files?.[0]);
    },
  };
}

const ON_IMAGE_BUTTON =
  'inline-flex min-h-10 items-center gap-2 rounded-full bg-black/55 px-3.5 text-13 font-medium text-white backdrop-blur transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60';

/* ── Hero banner ─────────────────────────────────────────────────────────── */

/**
 * The academy page's hero as visitors will see it: hero image (or an accent
 * wash when there is none), logo, name and subtitle, with the in-progress
 * accent colour and copy applied live. Replacing either image happens on it.
 */
export function AcademyHeroEditor({
  slug,
  heroImageUrl,
  logoUrl,
  accent,
  title,
  subtitle,
  onChanged,
  onUploadStart,
  onUploadEnd,
}: {
  slug: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  accent: string;
  title: string;
  subtitle: string;
  onChanged: () => void | Promise<void>;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const { mode } = useLanguageMode();
  const heroInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const shared = { slug, onChanged, onUploadStart, onUploadEnd };
  const hero = useAcademyImage({ ...shared, kind: 'hero', label: t('heroBanner') });
  const logo = useAcademyImage({ ...shared, kind: 'logo', label: t('logo') });

  return (
    <div className="flex flex-col gap-3">
      <div
        {...dropHandlers((file) => void hero.upload(file), setDrag)}
        dir={mode === 'ar' ? 'rtl' : undefined}
        className={cn(
          'relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-2xl border border-border/70 sm:aspect-[16/6] sm:min-h-0',
          drag && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
        )}
      >
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 transition-[background] duration-500"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}b3 55%, ${accent}40 100%)` }}
          />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

        <div className="absolute end-3 top-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => heroInput.current?.click()}
            disabled={hero.busy}
            className={ON_IMAGE_BUTTON}
          >
            {hero.uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {heroImageUrl ? t('replaceHero') : t('addHero')}
          </button>
          {heroImageUrl && (
            <button
              type="button"
              onClick={() => void hero.remove()}
              disabled={hero.busy}
              aria-label={t('removeLabel', { label: t('heroBanner') })}
              title={t('removeLabel', { label: t('heroBanner') })}
              className={cn(ON_IMAGE_BUTTON, 'w-10 justify-center px-0')}
            >
              {hero.deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          )}
        </div>

        <div className="flex min-w-0 items-end gap-3 p-4 sm:p-5">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              disabled={logo.busy}
              aria-label={logoUrl ? t('replaceLogo') : t('addLogo')}
              title={logoUrl ? t('replaceLogo') : t('addLogo')}
              className="group relative flex size-14 items-center justify-center overflow-hidden rounded-xl border-2 border-white/70 text-white shadow-md transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 sm:size-16"
              style={{ backgroundColor: logoUrl ? 'rgba(255,255,255,0.12)' : `${accent}99` }}
            >
              {logo.uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-full object-contain p-1" />
              ) : (
                <GraduationCap className="size-5" />
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex group-focus-visible:flex">
                <Upload className="size-4" />
              </span>
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => void logo.remove()}
                disabled={logo.busy}
                aria-label={t('removeLabel', { label: t('logo') })}
                title={t('removeLabel', { label: t('logo') })}
                className="absolute -end-3 -top-3 flex size-8 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {logo.deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              dir="auto"
              className="truncate font-display text-xl font-medium tracking-[-0.015em] text-white sm:text-2xl"
            >
              {title}
            </p>
            {subtitle && (
              <p dir="auto" className="line-clamp-2 text-13 text-white/85">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('heroHint')} {t('logoHint')} {t('imagesLiveNote')}
      </p>
      <input
        ref={heroInput}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          void hero.upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={logoInput}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          void logo.upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ── Accent colour ───────────────────────────────────────────────────────── */

export function AccentColorRow({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const valid = HEX.test(value);
  const ratio = contrastWithWhite(valid ? value : BRAND_CLAY);
  const passes = ratio !== null && ratio >= 4.5;
  const ratioText = ratio === null ? '' : ratio.toFixed(1);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-13 font-medium text-foreground">
        {t('accent')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('accent')} className="flex flex-wrap items-center gap-1">
          {ACCENT_PRESETS.map((preset) => {
            const selected = preset.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                aria-label={t('swatchLabel', { color: preset })}
                aria-pressed={selected}
                className="flex size-10 items-center justify-center rounded-full transition hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-7 rounded-full border border-black/10',
                    selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                  )}
                  style={{ backgroundColor: preset }}
                />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            aria-label={t('pickAccent')}
            title={t('pickAccent')}
            className="relative flex size-10 items-center justify-center rounded-full border border-dashed border-border-strong text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Pipette className="size-4" />
            <input
              ref={pickerRef}
              type="color"
              tabIndex={-1}
              aria-hidden="true"
              value={valid ? value.toLowerCase() : BRAND_CLAY.toLowerCase()}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="pointer-events-none absolute inset-0 size-full opacity-0"
            />
          </button>
        </div>
        <div className="flex min-h-11 w-36 items-center gap-2 rounded-lg border border-border/90 bg-card px-2.5 shadow-xs focus-within:border-primary/50 focus-within:ring-[3px] focus-within:ring-primary/15">
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-md border border-black/10"
            style={{ backgroundColor: valid ? value : 'transparent' }}
          />
          <input
            id={id}
            dir="ltr"
            value={value}
            maxLength={7}
            spellCheck={false}
            aria-invalid={!!error || undefined}
            aria-describedby={`${id}-note`}
            aria-label={t('accentLabel')}
            placeholder={BRAND_CLAY}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange(raw ? (raw.startsWith('#') ? raw : `#${raw}`).toUpperCase() : '');
            }}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
      <p
        id={`${id}-note`}
        role={error ? 'alert' : undefined}
        className={cn(
          'text-xs leading-relaxed',
          error ? 'text-destructive' : passes ? 'text-muted-foreground' : 'text-warning',
        )}
      >
        {error ??
          (passes ? t('contrastPass', { ratio: ratioText }) : t('contrastFail', { ratio: ratioText }))}
      </p>
    </div>
  );
}

/* ── Social image ────────────────────────────────────────────────────────── */

export function AcademyImageTile({
  slug,
  kind,
  label,
  hint,
  currentUrl,
  onChanged,
  onUploadStart,
  onUploadEnd,
}: {
  slug: string;
  kind: AcademyImageKind;
  label: string;
  hint: string;
  currentUrl: string | null;
  onChanged: () => void | Promise<void>;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const image = useAcademyImage({ slug, kind, label, onChanged, onUploadStart, onUploadEnd });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-13 font-medium text-foreground">{label}</span>
      <button
        type="button"
        {...dropHandlers((file) => void image.upload(file), setDrag)}
        onClick={() => inputRef.current?.click()}
        disabled={image.busy}
        aria-label={t('chooseImageFor', { label })}
        className={cn(
          'group relative flex aspect-[1200/630] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 text-center transition-colors',
          'hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          drag && 'border-primary/60 bg-primary/10',
          image.busy && 'opacity-60',
        )}
      >
        {currentUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt="" className="absolute inset-0 size-full object-cover" />
            <span className={cn(ON_IMAGE_BUTTON, 'relative')}>
              <ImagePlus className="size-4" />
              {t('replace')}
            </span>
          </>
        ) : image.uploading ? (
          <>
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{t('uploading')}</span>
          </>
        ) : (
          <>
            <Upload className="size-5 text-muted-foreground" />
            <span className="px-3 text-xs font-medium text-muted-foreground group-hover:text-foreground">
              {t('dropOrBrowse')}
            </span>
          </>
        )}
      </button>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        {currentUrl && (
          <button
            type="button"
            onClick={() => void image.remove()}
            disabled={image.busy}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-13 font-medium text-destructive transition hover:bg-destructive/8 disabled:opacity-50"
          >
            {image.deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            {t('remove')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          void image.upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ── Card on the academies page ──────────────────────────────────────────── */

/** Mirrors `components/academy/academy-card.tsx` with the in-progress copy and accent. */
export function AcademyCardPreview({
  title,
  subtitle,
  description,
  imageUrl,
  logoUrl,
  accent,
  courseCount,
}: {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string | null;
  logoUrl: string | null;
  accent: string;
  courseCount: number;
}) {
  const t = useTranslations('admin.academiesPage.editor');
  const { mode } = useLanguageMode();
  const ar = mode === 'ar';
  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      lang={ar ? 'ar' : 'en'}
      className="overflow-hidden rounded-2xl border border-border/70 bg-background"
    >
      <div className="relative m-2 mb-0 aspect-[16/10] overflow-hidden rounded-xl bg-surface-sunken">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}80 100%)` }}
          />
        )}
        {logoUrl && imageUrl !== logoUrl && (
          <div className="absolute start-2.5 top-2.5 size-9 overflow-hidden rounded-lg border-2 border-card bg-card shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="size-full object-cover" />
          </div>
        )}
        <span className="absolute end-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-2xs font-medium text-foreground shadow-sm">
          <BookOpen className="size-3" aria-hidden="true" />
          {t('previewCourseCount', { count: courseCount })}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-2xs font-medium"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {t('cardKind')}
          </span>
          {subtitle && <span className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <span className={cn('text-lg leading-snug text-foreground', !ar && 'font-display')}>{title}</span>
        <p className="line-clamp-2 text-13 leading-relaxed text-muted-foreground">
          {description || t('previewPlaceholderDesc')}
        </p>
        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-3">
          <span aria-hidden="true" className="h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
          <span className="inline-flex items-center gap-1 text-13 font-medium" style={{ color: accent }}>
            {t('cardCta')}
            <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
