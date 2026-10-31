'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';

/**
 * No-ops now that the service worker has been removed.
 *
 * It used to offer "refresh to update" when a newly installed worker was waiting. Without a
 * worker there is nothing to activate and nothing to dismiss, so the listener and the button
 * are gone. The component is kept so `app/layout.tsx` does not have to change, and so
 * removing it is a separate, reviewable step.
 */
export function PWAUpdateToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = () => setVisible(true);
    // Retained purely so a cached old page that still dispatches this does not throw.
    window.addEventListener('pwa:update-available' as never, onUpdate);
    return () => window.removeEventListener('pwa:update-available' as never, onUpdate);
  }, []);

  const handleRefresh = () => {
    setVisible(false);
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="pwa-update"
          role="status"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
          transition={spring.gentle}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-xl sm:inset-x-0"
        >
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
            App updated — refresh to get the latest.
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setVisible(false)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Later
            </button>
            <button
              onClick={handleRefresh}
              className="pressable inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
