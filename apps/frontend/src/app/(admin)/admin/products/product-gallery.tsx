'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crosshair, ImageOff, Star, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HotspotStudio } from '@/components/hotspot/hotspot-studio';
import { api } from '@/lib/api-client';
import { uploadImage } from '@/lib/upload';
import { toast } from '@/components/ui/toast';
import type { ProductImage } from './[slug]/edit/page';
import type { InteractiveHotspot } from '@titan/shared';

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
  const [studioImage, setStudioImage] = useState<ProductImage | null>(null);

  /**
   * Every gallery mutation goes through `api`.
   *
   * This wrapper used raw `fetch` with cookie credentials and no `x-csrf-token`, so the
   * CSRF guard rejected all six of them — add, reorder, set primary, delete, hotspots and
   * alt text. The buttons looked dead and nothing was being saved.
   *
   * `method` is taken explicitly rather than a raw `RequestInit` so the body is JSON-encoded
   * once, here, instead of at each call site.
   */
  const call = async <T,>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> => {
    if (method === 'DELETE') return api.delete<T>(`/admin/products/${slug}/images${path}`);
    if (method === 'PATCH') return api.patch<T>(`/admin/products/${slug}/images${path}`, body ?? {});
    return api.post<T>(`/admin/products/${slug}/images${path}`, body ?? {});
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
        // Direct to storage: a gallery photo is routinely over the 2 MB JSON ceiling,
        // and base64 made the wire payload a third bigger than the file for no reason.
        let url: string;
        try {
          ({ url } = await uploadImage(file, 'covers'));
        } catch (error) {
          toast({
            type: 'err',
            title: t('uploadFailed', { default: 'Upload failed' }),
            description: error instanceof Error ? error.message : file.name,
          });
          continue;
        }
        const created = await call<ProductImage>('POST', '', { url, alt: null });
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
      const saved = await call<ProductImage[]>('PATCH', '/reorder', { imageIds: ordered.map((i) => i.id) });
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
      await call('PATCH', `/${image.id}`, { setPrimary: true });
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
      const result = await call<{ nextPrimaryUrl?: string | null }>('DELETE', `/${image.id}`);
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

  /**
   * Hotspot edits PATCH the image on their own. Deliberately not folded into a product
   * save: hotspot data lives on `product_images`, and keeping the two request paths
   * apart is what guarantees a gallery save can never blank product fields.
   */
  const setHotspots = async (image: ProductImage, hotspots: InteractiveHotspot[]) => {
    const previous = images;
    onChange(images.map((i) => (i.id === image.id ? { ...i, hotspots } : i)));
    try {
      const saved = await call('PATCH', `/${image.id}`, { hotspots });
      onChange(Array.isArray(saved) ? saved : previous);
    } catch (error) {
      onChange(previous); // roll back to the server's truth
      toast({
        type: 'err',
        title: t('hotspotsFailed', { default: 'Could not save hotspots' }),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const setAlt = async (image: ProductImage, alt: string) => {
    onChange(images.map((i) => (i.id === image.id ? { ...i, alt } : i)));
    try {
      await call('PATCH', `/${image.id}`, { alt });
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
              {/*
                The tile stays a summary; editing opens the studio. Embedding the editor
                inline meant a 192px preview inside a grid cell, which is too small to place
                a marker accurately — and on a machine, a marker a few percent off points at
                the wrong feature.
              */}
              <button
                type="button"
                onClick={() => setStudioImage(image)}
                disabled={busy}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-start transition hover:border-primary/40 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2 text-2xs font-semibold text-muted-foreground">
                  <Crosshair className="size-3.5" />
                  {t('hotspotsTitle', { default: 'Hotspots' })}
                  {(image.hotspots ?? []).length > 0 ? (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                      {(image.hotspots ?? []).length}
                    </span>
                  ) : null}
                </span>
                <span className="text-2xs font-semibold text-primary">
                  {t('edit', { default: 'Edit' })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <HotspotStudio
        image={studioImage}
        open={studioImage !== null}
        onOpenChange={(next) => {
          if (!next) setStudioImage(null);
        }}
        disabled={busy}
        onSave={async (hotspots) => {
          if (!studioImage) return;
          await setHotspots(studioImage, hotspots);
          // Reflect the studio's own copy so reopening shows what was just saved.
          setStudioImage({ ...studioImage, hotspots });
        }}
      />
    </div>
  );
}
