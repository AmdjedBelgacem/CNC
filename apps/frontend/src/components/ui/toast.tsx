'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

type ToastType = 'ok' | 'err' | 'info';

export interface ToastItem {
  type: ToastType;
  title: string;
  description?: string;
}

/**
 * App-wide toast helper.
 *
 * The platform standardised on Sonner for transient feedback. This adapter keeps
 * the existing `toast({ type, title, description })` call sites working while
 * routing every notification through Sonner, so success/error/info toasts share
 * one queue, one animation and one accessible live region.
 */
export function toast(item: ToastItem) {
  const options = item.description ? { description: item.description } : undefined;
  if (item.type === 'ok') {
    sonnerToast.success(item.title, options);
    return;
  }
  if (item.type === 'err') {
    sonnerToast.error(item.title, options);
    return;
  }
  sonnerToast.info(item.title, options);
}

/**
 * Mounts the single Sonner viewport. It is rendered once in the root layout; the
 * builder no longer mounts its own copy (two viewports duplicated every toast).
 */
export function ToastViewport({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  // Sonner is mounted outside ThemeProvider in the root layout, so observe the
  // resolved class on <html> rather than importing the provider (which would
  // create a cycle: ThemeProvider imports this module for its error toast).
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      dir={dir}
      theme={theme}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      duration={4500}
      closeButton
      richColors
      toastOptions={{
        // Match the tenant theme tokens instead of Sonner's stock palette so the
        // toasts look native in both light and dark mode.
        style: {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          fontFamily: 'var(--font-sans)',
        } as CSSProperties,
        classNames: {
          toast: 'rounded-xl border shadow-lg',
          title: 'text-13 font-semibold',
          description: 'text-xs leading-relaxed',
        },
      }}
    />
  );
}
