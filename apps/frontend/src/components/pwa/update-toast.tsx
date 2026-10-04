'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function PWAUpdateToast() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onUpdate = () => setVisible(true);
    window.addEventListener('pwa:update-available' as any, onUpdate);
    return () => window.removeEventListener('pwa:update-available' as any, onUpdate);
  }, []);
  const handleRefresh = () => {
    /* Tell the waiting SW to activate immediately */
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.waiting?.postMessage({ type: 'SKIP_WAITING' }));
    });
    /* Fallback: hard reload after a short delay to pick up the new assets */
    setTimeout(() => window.location.reload(), 400);
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
