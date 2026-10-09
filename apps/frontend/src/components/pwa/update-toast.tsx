'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

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

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-sm font-medium">App updated — refresh to get the latest.</p>
      <button
        onClick={handleRefresh}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className="size-3.5" /> Refresh
      </button>
      <button onClick={() => setVisible(false)} className="text-xs text-muted-foreground hover:text-foreground">
        Later
      </button>
    </div>
  );
}
