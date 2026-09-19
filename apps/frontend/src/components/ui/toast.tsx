'use client';
import { create } from 'zustand';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
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
})); /** Fire-and-forget toast; auto-dismisses after 4.5s. */
export function toast(item: Omit<ToastItem, 'id'>) {
  const id = useToasts.getState().push(item);
  window.setTimeout(() => useToasts.getState().dismiss(id), 4500);
}
const ICONS: Record<ToastType, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
  err: <TriangleAlert className="h-4 w-4 text-red-600 dark:text-red-400" />,
  info: <Info className="h-4 w-4 text-primary" />,
};
export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <ToastPrimitive.Provider duration={4500} swipeDirection="right">
      {' '}
      <ToastPrimitive.Viewport className="fixed bottom-20 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none lg:bottom-4" />{' '}
      <AnimatePresence>
        {' '}
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-white p-3 shadow-sm dark:bg-white"
          >
            {' '}
            <span className="mt-0.5 shrink-0">{ICONS[t.type]}</span>{' '}
            <div className="min-w-0 flex-1">
              {' '}
              <p className="text-[13px] font-semibold text-foreground">{t.title}</p>{' '}
              {t.description && (
                <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              )}{' '}
            </div>{' '}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
            >
              {' '}
              <X className="h-3 w-3" />{' '}
            </button>{' '}
          </motion.div>
        ))}{' '}
      </AnimatePresence>{' '}
    </ToastPrimitive.Provider>
  );
}
