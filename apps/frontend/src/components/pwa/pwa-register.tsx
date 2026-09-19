'use client';
import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        /* Listen for updates */
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('pwa:update-available'));
            }
          });
        });
      } catch (err) {
        // SW registration may fail on unsupported browsers or insecure contexts — non-fatal
        console.warn('[PWA] Service worker registration failed:', err);
      }
    };
    register();
  }, []);
  return null;
}
