'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Languages, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { harvestPageLayout, type PageLayout } from '@titan/shared';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { readApiError } from '@/lib/api-error';
import { toast } from '@/components/ui/toast';
import { builderActions } from './builder-actions';
import { useOpenPage } from './use-open-page';
import { useBuilderUI } from './builder-ui-store';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
import { VIEWPORTS } from './editor-header';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck'; /**
 * Floating canvas control bar (device switcher + zoom), replacing Puck's * built-in ViewportControls — which are kept mounted but invisible so the * internal zoom machinery (zoomConfig/select) still works; this bar simply * drives those hidden controls and mirrors their state. */
export function CanvasControls() {
  const tb = useTranslations('builder');
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const currentWidth = useBuilderPuck((s) => s.appState.ui.viewports?.current?.width);
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  const [zoom, setZoom] = useState(1);
  const canvasLocale = useBuilderUI((state) => state.canvasLocale);
  const setCanvasLocale = useBuilderUI((state) => state.setCanvasLocale);
  const [autoZoom, setAutoZoom] = useState<number | null>(null);
  const [canZoomIn, setCanZoomIn] = useState(false);
  const [canZoomOut, setCanZoomOut] = useState(false);
  useEffect(() => {
    if (!isDesktop) return;
    let observer: MutationObserver | null = null;
    let tries = 0;
    const read = () => {
      const root = document.getElementById('puck-canvas-root');
      if (root) {
        const m = /scale\(([\d.]+)\)/.exec(root.style.transform ?? '');
        if (m?.[1]) setZoom(parseFloat(m[1]));
      }
      const controls = document.querySelector<HTMLElement>('._PuckCanvas-controls_18jay_16');
      const select = controls?.querySelector<HTMLSelectElement>('select');
      if (select) {
        const opts = [...select.options];
        const autoOpt = opts.find((o) => o.label.includes('(Auto)'));
        if (autoOpt) setAutoZoom(parseFloat(autoOpt.value));
        else if (opts.length) setAutoZoom(Math.max(...opts.map((o) => parseFloat(o.value))));
      }
      const zoomInBtn = document.querySelector<HTMLButtonElement>(
        '._PuckCanvas-controls_18jay_16 [title="Zoom viewport in"]',
      );
      const zoomOutBtn = document.querySelector<HTMLButtonElement>(
        '._PuckCanvas-controls_18jay_16 [title="Zoom viewport out"]',
      );
      if (zoomInBtn) setCanZoomIn(!zoomInBtn.disabled);
      if (zoomOutBtn) setCanZoomOut(!zoomOutBtn.disabled);
    };
    const timer = setInterval(() => {
      tries += 1;
      const controls = document.querySelector<HTMLElement>('._PuckCanvas-controls_18jay_16');
      const root = document.getElementById('puck-canvas-root');
      if (!controls || !root) {
        if (tries > 150) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      read();
      observer = new MutationObserver(read);
      observer.observe(root, { attributes: true, attributeFilter: ['style'] });
      const zoomInBtn = controls.querySelector<HTMLButtonElement>('[title="Zoom viewport in"]');
      const zoomOutBtn = controls.querySelector<HTMLButtonElement>('[title="Zoom viewport out"]');
      if (zoomInBtn)
        observer.observe(zoomInBtn, { attributes: true, attributeFilter: ['disabled'] });
      if (zoomOutBtn)
        observer.observe(zoomOutBtn, { attributes: true, attributeFilter: ['disabled'] }); // Also watch for controls subtree changes (Puck re-creates select on viewport switch)
      observer.observe(controls, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'value'],
      });
    }, 150);
    return () => {
      clearInterval(timer);
      observer?.disconnect();
    };
  }, [isDesktop]);
  if (!isDesktop) return null;
  const setViewport = (width: number) =>
    dispatch({
      type: 'setUi',
      ui: (ui: any) => ({ viewports: { ...ui.viewports, current: { width, height: 'auto' } } }),
    } as never);
  const fitToScreen = () => {
    const controls = document.querySelector<HTMLElement>('._PuckCanvas-controls_18jay_16');
    const select = controls?.querySelector('select') as HTMLSelectElement | null;
    if (!select || autoZoom == null) return; // Bypass React's value tracker (setting .value directly is deduped)
    const proto =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(select), 'value')?.set ??
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (proto) proto.call(select, String(autoZoom));
    else select.value = String(autoZoom);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const zoomOut = () => {
    const controls = document.querySelector<HTMLElement>('._PuckCanvas-controls_18jay_16');
    const btn = controls?.querySelector('[title="Zoom viewport out"]') as HTMLButtonElement | null;
    btn?.click();
  };
  const zoomIn = () => {
    const controls = document.querySelector<HTMLElement>('._PuckCanvas-controls_18jay_16');
    const btn = controls?.querySelector('[title="Zoom viewport in"]') as HTMLButtonElement | null;
    btn?.click();
  };
  const isAuto = autoZoom != null && Math.abs(zoom - autoZoom) < 0.005;
  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0, transition: spring.gentle }}
        className="flex items-center gap-1 rounded-full border border-border/70 bg-card/90 p-1 shadow-md backdrop-blur-md"
      >
        {' '}
        <div className="flex items-center gap-0.5">
          {' '}
          {VIEWPORTS.map((vp) => {
            const Icon = vp.icon;
            const active = currentWidth === vp.width;
            const name = tb(`canvas.${vp.labelKey}`, { default: vp.label });
            return (
              <button
                key={vp.label}
                type="button"
                title={tb('canvas.viewportTitle', {
                  label: name,
                  width: vp.width,
                  default: `${vp.label} (${vp.width}px)`,
                })}
                onClick={() => setViewport(vp.width)}
                aria-pressed={active}
                className={cn(
                  'relative flex h-7 w-8 items-center justify-center rounded-full transition-colors active:scale-[0.94]',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {active && (
                  <m.span
                    layoutId="builder-canvas-viewport-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    transition={spring.snappy}
                  />
                )}
                <Icon className="relative size-3.5" />
              </button>
            );
          })}{' '}
        </div>{' '}
        <div className="mx-0.5 h-4 w-px bg-border/80" />
        {/* Content language of the canvas. Arabic shows exactly what Arabic visitors get. */}
        <div className="flex items-center gap-0.5" role="group" aria-label={tb('canvas.language')}>
          {(['en', 'ar'] as const).map((value) => {
            const active = canvasLocale === value;
            return (
              <button
                key={value}
                type="button"
                lang={value}
                title={value === 'ar' ? tb('canvas.previewArabic') : tb('canvas.editEnglish')}
                aria-pressed={active}
                onClick={() => setCanvasLocale(value)}
                className={cn(
                  'relative flex h-7 min-w-8 items-center justify-center rounded-full px-2 text-2xs font-semibold transition-colors active:scale-[0.94]',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {active && (
                  <m.span
                    layoutId="builder-canvas-locale-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    transition={spring.snappy}
                  />
                )}
                <span className="relative">{value === 'ar' ? 'ع' : 'EN'}</span>
              </button>
            );
          })}
        </div>
        <div className="mx-0.5 h-4 w-px bg-border/80" />
        <button
          type="button"
          title={tb('canvas.zoomOut', { default: 'Zoom out' })}
          disabled={!canZoomOut}
          onClick={zoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-35"
        >
          {' '}
          <ZoomOut className="size-3.5" />{' '}
        </button>{' '}
        <button
          type="button"
          title={tb('canvas.zoomToFit', { default: 'Zoom to fit' })}
          onClick={fitToScreen}
          className={cn(
            'h-7 min-w-[3.25rem] rounded-full px-2 font-mono text-2xs font-medium tabular-nums transition-colors',
            isAuto ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
          )}
        >
          {' '}
          {isAuto
            ? tb('canvas.auto', { default: 'Auto' })
            : `${Math.round(zoom * 100)}%`}{' '}
        </button>{' '}
        <button
          type="button"
          title={tb('canvas.zoomIn', { default: 'Zoom in' })}
          disabled={!canZoomIn}
          onClick={zoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-35"
        >
          {' '}
          <ZoomIn className="size-3.5" />{' '}
        </button>
      </m.div>
      {canvasLocale === 'ar' && <ArabicCoverageNote />}
    </div>
  );
}

const ARABIC_TEXT = /[\u0600-\u06FF]/;
const LATIN_WORD = /[A-Za-z]{2,}/;

/**
 * What the Arabic preview is missing, and a one-click fix.
 *
 * Counts the text fields that are still English in exactly the tree the canvas is showing (the
 * merged Arabic layout), so the number matches what Arabic visitors would read in English.
 */
function ArabicCoverageNote() {
  const tb = useTranslations('builder');
  const data = useBuilderPuck((state) => state.appState.data) as unknown as PageLayout;
  const { slug } = useOpenPage();
  const [busy, setBusy] = useState(false);
  const untranslated = useMemo(() => {
    try {
      const { fields } = harvestPageLayout(data);
      return Object.values(fields).filter(
        (value) => !ARABIC_TEXT.test(value) && LATIN_WORD.test(value) && !/^(https?:|mailto:|tel:|\/|#)/i.test(value.trim()),
      ).length;
    } catch {
      return 0;
    }
  }, [data]);

  const translate = async () => {
    setBusy(true);
    try {
      const res = await apiProxyFetch(`/api/proxy/builder/pages/${slug}/translate-arabic`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiError(res, tb('canvas.translateFailed')));
      const body = (await res.json()) as { translated: number; translations: { ar?: { layout?: PageLayout } } | null };
      const layout = body.translations?.ar?.layout;
      if (layout) builderActions.current?.setArabicLayout(layout);
      toast({ type: 'ok', title: tb('canvas.translated', { count: body.translated }) });
    } catch (error) {
      toast({ type: 'err', title: tb('canvas.translateFailed'), description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const complete = untranslated === 0;
  return (
    <m.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0, transition: spring.gentle }}
      className={cn(
        'mx-auto mt-2 flex w-max max-w-[min(32rem,84vw)] items-center gap-2 rounded-full border py-1 ps-3 pe-1 text-2xs font-medium shadow-sm backdrop-blur-md',
        complete ? 'border-border/70 bg-card/90 text-muted-foreground' : 'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      <span className="min-w-0 truncate">
        {complete ? tb('canvas.arabicPreviewNote') : tb('canvas.untranslated', { count: untranslated })}
      </span>
      {!complete && (
        <button
          type="button"
          onClick={() => void translate()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Languages className="size-3" aria-hidden="true" />}
          {tb('canvas.translateNow')}
        </button>
      )}
    </m.div>
  );
}
