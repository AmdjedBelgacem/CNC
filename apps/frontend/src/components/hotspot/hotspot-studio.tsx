'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Crosshair, Loader2, MousePointerClick, Trash2 } from 'lucide-react';
import type { InteractiveHotspot } from '@titan/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const MAX_HOTSPOTS = 20;

/** The gallery row shape, declared here so a shared component never imports from a page. */
export interface StudioImage {
  id: string;
  url: string;
  alt: string | null;
  hotspots?: InteractiveHotspot[] | null;
}

/**
 * Hotspot editor for one image.
 *
 * The previous version was inline in the gallery tile: a 192px-tall preview with
 * `pointer-events-none` markers, so a marker could be placed but not selected, moved, or
 * removed by clicking it, and there was no way to see how the storefront popup would look
 * before publishing. Placement accuracy matters more here than anywhere else — a marker a
 * few percent off points at the wrong feature on a machine.
 *
 * So: a large stage, markers you can select and drag, a side panel for the selected
 * marker, and a live preview of the storefront popover.
 */
export function HotspotStudio({
  image,
  open,
  onOpenChange,
  onSave,
  disabled,
}: {
  image: StudioImage | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSave: (hotspots: InteractiveHotspot[]) => Promise<void>;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.productGallery');
  const [draft, setDraft] = useState<InteractiveHotspot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const loadedImageId = useRef<string | null>(null);

  /*
   * Load the image's markers when the dialog opens, so a cancelled edit leaves nothing
   * half-applied in the parent.
   *
   * This used to run during render and only when `draft` was empty. That made the
   * editor depend on the parent already holding the saved markers: if the gallery's
   * copy was stale, the draft silently stayed empty. Keying the load to the image id
   * (and resetting on close) makes opening the studio deterministic.
   */
  useEffect(() => {
    if (!open) {
      loadedImageId.current = null;
      return;
    }
    if (!image || loadedImageId.current === image.id) return;
    loadedImageId.current = image.id;
    setDraft(image.hotspots ?? []);
    setSelectedId(null);
    setPlacing(false);
  }, [open, image]);

  const close = () => {
    loadedImageId.current = null;
    setDraft([]);
    setSelectedId(null);
    setPlacing(false);
    onOpenChange(false);
  };

  const percentFrom = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = (stageRef.current ?? event.currentTarget).getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Number(
        Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2),
      ),
      y: Number(
        Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2),
      ),
    };
  };

  const addAt = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!placing) return;
    const at = percentFrom(event);
    if (!at) return;
    const hotspot: InteractiveHotspot = {
      id: `pinpoint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: at.x,
      y: at.y,
      label: t('hotspotDefaultLabel', { n: draft.length + 1, default: 'Point {n}' }),
      tooltip: null,
      detail: null,
    };
    setDraft([...draft, hotspot]);
    setSelectedId(hotspot.id);
    setPlacing(false);
  };

  /** Drag a marker. Pointer capture keeps the drag alive past the marker's own box. */
  const drag = (event: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    const onMove = (move: PointerEvent) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const x = Number(
        Math.min(100, Math.max(0, ((move.clientX - rect.left) / rect.width) * 100)).toFixed(2),
      );
      const y = Number(
        Math.min(100, Math.max(0, ((move.clientY - rect.top) / rect.height) * 100)).toFixed(2),
      );
      setDraft((current) => current.map((h) => (h.id === id ? { ...h, x, y } : h)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const update = (id: string, patch: Partial<InteractiveHotspot>) =>
    setDraft((current) => current.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const remove = (id: string) => {
    setDraft((current) => current.filter((h) => h.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      close();
    } catch {
      // The gallery shows the failure toast. Keep the editor open so the draft survives.
    } finally {
      setSaving(false);
    }
  };

  const selected = draft.find((h) => h.id === selectedId) ?? null;
  const selectedIndex = draft.findIndex((h) => h.id === selectedId);

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Crosshair className="size-4" />
            {t('studioTitle', { default: 'Hotspots' })}
          </DialogTitle>
          <DialogDescription>
            {t('studioDescription', {
              default:
                'Click the image to drop a numbered marker, then give it a label. Markers belong to this image only.',
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* ---------------------------------------------------------- stage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                  {draft.length}/{MAX_HOTSPOTS}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={placing ? 'default' : 'outline'}
                  disabled={disabled || draft.length >= MAX_HOTSPOTS}
                  onClick={() => setPlacing((v) => !v)}
                >
                  <MousePointerClick className="size-4" />
                  {placing
                    ? t('cancel', { default: 'Cancel' })
                    : t('addHotspot', { default: 'Add hotspot' })}
                </Button>
              </div>

              <div
                ref={stageRef}
                onClick={addAt}
                className={cn(
                  'relative flex max-h-[52vh] min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40',
                  placing && 'cursor-crosshair ring-2 ring-primary',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt ?? ''}
                  className="block max-h-[52vh] w-auto max-w-full select-none object-contain"
                  draggable={false}
                />

                {draft.map((h, index) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={h.label}
                    aria-pressed={selectedId === h.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(h.id);
                    }}
                    onPointerDown={(e) => drag(e, h.id)}
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    className={cn(
                      'absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-lg transition active:cursor-grabbing',
                      selectedId === h.id
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                        : 'bg-primary/90 text-primary-foreground hover:scale-110',
                    )}
                  >
                    {index + 1}
                  </button>
                ))}

                {draft.length === 0 && !placing ? (
                  <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">
                    {t('hotspotsEmpty', { default: 'No hotspots on this image yet.' })}
                  </p>
                ) : null}
              </div>
            </div>

            {/* ---------------------------------------------------------- panel */}
            <div className="space-y-4">
              {selected ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {selectedIndex + 1}
                      </span>
                      {t('selected', { default: 'Selected marker' })}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => remove(selected.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="size-3" />
                      {t('remove', { default: 'Remove' })}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="hs-label">{t('hotspotLabel', { default: 'Label' })}</Label>
                      <Input
                        id="hs-label"
                        value={selected.label}
                        onChange={(e) => update(selected.id, { label: e.target.value })}
                        placeholder={t('hotspotLabel', { default: 'Label' })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hs-tooltip">
                        {t('hotspotTooltip', { default: 'Tooltip on hover' })}
                      </Label>
                      <Input
                        id="hs-tooltip"
                        value={selected.tooltip ?? ''}
                        onChange={(e) => update(selected.id, { tooltip: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hs-detail">
                        {t('hotspotDetail', { default: 'Shown in the popup when tapped' })}
                      </Label>
                      <textarea
                        id="hs-detail"
                        rows={4}
                        value={selected.detail ?? ''}
                        onChange={(e) => update(selected.id, { detail: e.target.value || null })}
                        className="flex w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Mirrors the storefront popover so the copy can be judged in place. */}
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                    <p className="mb-2 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                      {t('preview', { default: 'Storefront preview' })}
                    </p>
                    <div className="rounded-lg border border-primary/25 bg-card p-3">
                      <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                        {selectedIndex + 1}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {selected.label || '—'}
                      </p>
                      {selected.tooltip ? (
                        <p className="mt-1 text-xs text-muted-foreground">{selected.tooltip}</p>
                      ) : null}
                      {selected.detail ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {selected.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('selectHint', {
                      default: 'Select a marker to edit it, or add one.',
                    })}
                  </p>
                  {draft.length > 0 ? (
                    <ul className="space-y-1.5">
                      {draft.map((h, index) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(h.id)}
                            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-start text-xs transition hover:border-primary/40"
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{h.label || '—'}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {Math.round(h.x)}%, {Math.round(h.y)}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            {t('cancel', { default: 'Cancel' })}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || disabled}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('save', { default: 'Save hotspots' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
