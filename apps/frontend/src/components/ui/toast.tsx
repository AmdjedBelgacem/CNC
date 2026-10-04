'use client';
import { create } from 'zustand';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AnimatePresence, m } from 'framer-motion';
import { spring } from '@/lib/motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'ok' | 'err' | 'info';
export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}
interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => number;
  dismiss: (id: number) => void;
}
let toastId = 1;
export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Fire-and-forget toast; auto-dismisses after 4.5s. */
export function toast(item: Omit<ToastItem, 'id'>) {
  const id = useToasts.getState().push(item);
  if (typeof window !== 'undefined') {
    window.setTimeout(() => useToasts.getState().dismiss(id), 4500);
  }
}

const TONE: Record<ToastType, { icon: React.ReactNode; ring: string }> = {
  ok: { icon: <CheckCircle2 className="size-4 text-success" />, ring: 'bg-success/10' },
  err: { icon: <TriangleAlert className="size-4 text-destructive" />, ring: 'bg-destructive/10' },
  info: { icon: <Info className="size-4 text-info" />, ring: 'bg-info/10' },
};

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <ToastPrimitive.Provider duration={4500}>
      <ToastPrimitive.Viewport className="fixed bottom-4 end-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      <AnimatePresence>
        {toasts.map((t) => {
          const tone = TONE[t.type];
          return (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={spring.snappy}
              className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
            >
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                  tone.ring,
                )}
              >
                {tone.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-13 font-semibold text-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </m.div>
          );
        })}
      </AnimatePresence>
    </ToastPrimitive.Provider>
  );
}
