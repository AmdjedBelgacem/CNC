'use client';
import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, IS_DESKTOP_QUERY } from '@/lib/use-media-query';
import { VIEWPORTS } from './editor-header';
import { useBuilderPuck } from '@/lib/builder/use-builder-puck'; /**
 * Floating canvas control bar (device switcher + zoom), replacing Puck's * built-in ViewportControls — which are kept mounted but invisible so the * internal zoom machinery (zoomConfig/select) still works; this bar simply * drives those hidden controls and mirrors their state. */
export function CanvasControls() {
  const dispatch = useBuilderPuck((s) => s.dispatch);
  const currentWidth = useBuilderPuck((s) => s.appState.ui.viewports?.current?.width);
  const isDesktop = useMediaQuery(IS_DESKTOP_QUERY);
  const [zoom, setZoom] = useState(1);
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
      {' '}
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/85 p-1 shadow-sm dark:shadow-black/40">
        {' '}
        <div className="flex items-center gap-0.5">
          {' '}
          {VIEWPORTS.map((vp) => {
            const Icon = vp.icon;
            const active = currentWidth === vp.width;
            return (
              <button
                key={vp.label}
                type="button"
                title={`${vp.label} (${vp.width}px)`}
                onClick={() => setViewport(vp.width)}
                className={cn(
                  'flex h-7 w-8 items-center justify-center rounded-full transition',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {' '}
                <Icon className="h-3.5 w-3.5" />{' '}
              </button>
            );
          })}{' '}
        </div>{' '}
        <div className="mx-0.5 h-4 w-px bg-border" />{' '}
        <button
          type="button"
          title="Zoom out"
          disabled={!canZoomOut}
          onClick={zoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
        >
          {' '}
          <ZoomOut className="h-3.5 w-3.5" />{' '}
        </button>{' '}
        <button
          type="button"
          title="Zoom to fit"
          onClick={fitToScreen}
          className={cn(
            'h-7 min-w-[3.25rem] rounded-full px-2 text-[11px] font-bold tabular-nums transition',
            isAuto ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
          )}
        >
          {' '}
          {isAuto ? 'Auto' : `${Math.round(zoom * 100)}%`}{' '}
        </button>{' '}
        <button
          type="button"
          title="Zoom in"
          disabled={!canZoomIn}
          onClick={zoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
        >
          {' '}
          <ZoomIn className="h-3.5 w-3.5" />{' '}
        </button>{' '}
      </div>{' '}
    </div>
  );
}
