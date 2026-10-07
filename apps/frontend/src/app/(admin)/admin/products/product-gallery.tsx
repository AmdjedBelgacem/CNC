'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageOff, Star, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import type { ProductImage } from './[slug]/edit/page';

const MAX_IMAGES = 12;

/**
 * Gallery manager for a product.
 *
 * Every action is a dedicated request against /admin/products/:slug/images, and the
 * server's response is what the UI renders. The gallery is deliberately NOT part of the
 * product PATCH body: an ordinary save then cannot possibly touch images, which is the
 * structural half of the data-loss fix.
 */
export function ProductGalleryManager({
  slug,
  images,
  onChange,
  onUploadStart,
  onUploadEnd,
}: {
  slug: string;
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}) {
  const t = useTranslations('admin.productGallery');
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const call = async (path: string, init: RequestInit) => {
    const res = await fetch(`/api/proxy/admin/products/${slug}/images${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message ?? `Request failed (${res.status})`);
    }
    return res.json();
  };

  /** Upload -> attach. The DB row is only created from a URL this storefront produced. */
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast({ type: 'err', title: t('limitReached', { max: MAX_IMAGES, default: 'Maximum {max} images reached.' }) });
      return;
    }
    const accepted = Array.from(files).slice(0, room);
    setBusy(true);
    onUploadStart?.();
    try {
      let next = [...images];
      for (const file of accepted) {
        if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) {
          toast({ type: 'err', title: t('badType', { default: 'Unsupported image type' }), description: file.name });
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast({ type: 'err', title: t('tooLarge', { default: 'Image too large' }), description: file.name });
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const upload = await fetch('/api/proxy/admin/products/upload', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: dataUrl, folder: 'covers', name: file.name }),
        });
        if (!upload.ok) {
          toast({ type: 'err', title: t('uploadFailed', { default: 'Upload failed' }), description: file.name });
          continue;
        }
        const { url } = await upload.json();
        const created = await call('', {
          method: 'POST',
          body: JSON.stringify({ url, alt: null }),
        });
        next = [...next, created];
      }
      onChange(next);
      toast({ type: 'ok', title: t('added', { default: 'Image added' }) });
    } catch (error) {
      toast({
        type: 'err',
        title: t('addFailed', { default: 'Could not add image' }),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      onUploadEnd?.();
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    const ordered = next.map((image, i) => ({ ...image, sortOrder: i }));
    onChange(ordered); // optimistic: the controls stay responsive
    setBusy(true);
    try {
      const saved = await call('/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ imageIds: ordered.map((i) => i.id) }),
      });
      onChange(saved);
    } catch (error) {
      onChange(images); // roll back to the server's truth
      toast({
        type: 'err',
        title: t('reorderFailed', { default: 'Could not reorder' }),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const setPrimary = async (image: ProductImage) => {
    setBusy(true);
    try {
      await call(`/${image.id}`, { method: 'PATCH', body: JSON.stringify({ setPrimary: true }) });
      onChange(images.map((i) => ({ ...i, isPrimary: i.id === image.id })));
      toast({ type: 'ok', title: t('primarySet', { default: 'Primary image updated' }) });
    } catch (error) {
      toast({
        type: 'err',
        title: t('primaryFailed', { default: 'Could not set primary' }),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (image: ProductImage) => {
    setBusy(true);
    try {
      const result = await call(`/${image.id}`, { method: 'DELETE' });
      const remaining = images.filter((i) => i.id !== image.id);
      // The server promotes another image when the primary is deleted; reflect that.
      onChange(
        remaining.map((i) => ({ ...i, isPrimary: result?.nextPrimaryUrl ? i.url === result.nextPrimaryUrl : i.isPrimary })),
      );
      toast({ type: 'ok', title: t('removed', { default: 'Image removed' }) });
    } catch (error) {
      toast({
        type: 'err',
        title: t('removeFailed', { default: 'Could not remove image' }),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const setAlt = async (image: ProductImage, alt: string) => {
    onChange(images.map((i) => (i.id === image.id ? { ...i, alt } : i)));
    try {
      await call(`/${image.id}`, { method: 'PATCH', body: JSON.stringify({ alt }) });
    } catch {
      onChange(images);
      toast({ type: 'err', title: t('altFailed', { default: 'Could not save alt text' }) });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || images.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-50"
        >
          <Upload className="size-4" />
          {busy ? t('working', { default: 'Working…' }) : t('add', { default: 'Add images' })}
        </button>
        <span className="text-xs text-muted-foreground">
          {t('count', { used: images.length, max: MAX_IMAGES, default: '{used} of {max}' })}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="sr-only"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-xs text-muted-foreground">
          <ImageOff className="size-4" />
          {t('empty', { default: 'No images yet. The storefront falls back to a placeholder.' })}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt ?? ''}
                  className="size-20 shrink-0 rounded-lg border border-border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={image.alt ?? ''}
                    onChange={(e) => onChange(images.map((i) => (i.id === image.id ? { ...i, alt: e.target.value } : i)))}
                    onBlur={(e) => void setAlt(image, e.target.value)}
                    placeholder={t('alt', { default: 'Alt text (describe the image)' })}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs outline-none focus:border-primary/60"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void setPrimary(image)}
                      disabled={busy || image.isPrimary}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-2xs font-semibold transition',
                        image.isPrimary
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground hover:bg-primary/8',
                      )}
                    >
                      <Star className="size-3" />
                      {image.isPrimary ? t('primary', { default: 'Primary' }) : t('makePrimary', { default: 'Make primary' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={t('moveUp', { default: 'Move earlier' })}
                      className="rounded-lg border border-border px-2 py-1 text-2xs font-semibold transition hover:bg-primary/8 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(index, 1)}
                      disabled={busy || index === images.length - 1}
                      aria-label={t('moveLater', { default: 'Move later' })}
                      className="rounded-lg border border-border px-2 py-1 text-2xs font-semibold transition hover:bg-primary/8 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(image)}
                      disabled={busy}
                      aria-label={t('remove', { default: 'Remove image' })}
                      className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-2xs font-semibold text-destructive transition hover:bg-destructive/8 disabled:opacity-40"
                    >
                      <X className="size-3" />
                      {t('remove', { default: 'Remove' })}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
