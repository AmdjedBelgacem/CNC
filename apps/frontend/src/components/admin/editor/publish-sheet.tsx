'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, m } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { CheckList, type EditorCheck } from './editor-kit';

/**
 * The review before something goes live (or comes down).
 *
 * Publishing used to be a button in the command bar that published first and
 * validated afterwards, so the reasons a record was not ready arrived as a
 * banner after the fact. The sheet shows the checks, how complete the Arabic
 * is and what Arabic visitors will see, and only then offers the action.
 */
export function PublishSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  lead,
  checks,
  arabic,
  arabicPreview,
  isPublished,
  busy,
  blocked,
  onPublish,
  onUnpublish,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  checks: EditorCheck[];
  /** Arabic coverage, when the record is translatable. */
  arabic?: { translated: number; total: number; onDraft?: () => void; drafting?: boolean };
  arabicPreview?: ReactNode;
  isPublished: boolean;
  busy: boolean;
  /** A required check failed: publishing is not offered. */
  blocked?: boolean;
  onPublish: () => void;
  onUnpublish?: () => void;
  /** Close the sheet and take the editor to the field a check names. */
  onJump?: (target: string) => void;
}) {
  const t = useTranslations('admin.editorKit.publish');
  const missing = arabic ? Math.max(0, arabic.total - arabic.translated) : 0;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-overlay/45 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2, ease: ease.emerge } }}
                exit={{ opacity: 0, transition: { duration: 0.15, ease: ease.exit } }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <m.section
                className="fixed inset-y-0 end-0 z-50 flex w-full max-w-[38rem] flex-col bg-card shadow-2xl focus:outline-none"
                initial={{ x: '8%', opacity: 0 }}
                animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 38 } }}
                exit={{ x: '6%', opacity: 0, transition: { duration: 0.16, ease: ease.exit } }}
              >
                <header className="flex items-start justify-between gap-3 border-b border-border/70 px-6 py-5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {eyebrow}
                    </span>
                    <DialogPrimitive.Title className="font-display text-[1.625rem] font-medium leading-tight tracking-[-0.015em] text-foreground">
                      {title}
                    </DialogPrimitive.Title>
                    {lead && <p className="text-13 text-muted-foreground">{lead}</p>}
                  </div>
                  <DialogPrimitive.Close
                    aria-label={t('close')}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/70"
                  >
                    <X className="size-4" />
                  </DialogPrimitive.Close>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[0.9375rem] font-semibold text-foreground">{t('checks')}</h3>
                    <CheckList
                      checks={checks}
                      onJump={(target) => {
                        onOpenChange(false);
                        if (onJump) onJump(target);
                        else window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'center' }), 200);
                      }}
                    />
                  </div>

                  {arabic && arabic.total > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-[0.9375rem] font-semibold text-foreground">{t('arabic')}</h3>
                        <span className="text-xs text-muted-foreground">
                          {t('arabicCoverage', { translated: arabic.translated, total: arabic.total })}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.round((arabic.translated / arabic.total) * 100)}%` }}
                        />
                      </div>
                      {missing > 0 && (
                        <p className="text-13 leading-relaxed text-muted-foreground">
                          {t('arabicMissing', { count: missing })}{' '}
                          {arabic.onDraft && (
                            <button
                              type="button"
                              onClick={arabic.onDraft}
                              disabled={arabic.drafting}
                              className="inline-flex min-h-6 items-center gap-1 font-medium text-primary hover:underline disabled:opacity-60"
                            >
                              {arabic.drafting && <Loader2 className="size-3 animate-spin" />}
                              {t('draftMissing')}
                            </button>
                          )}
                        </p>
                      )}
                      {arabicPreview && (
                        <div
                          dir="rtl"
                          lang="ar"
                          className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background p-4"
                        >
                          {arabicPreview}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/40 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                  <span className="text-xs text-muted-foreground">{t('audited')}</span>
                  <div className="flex flex-wrap gap-2">
                    {isPublished && onUnpublish ? (
                      <button
                        type="button"
                        onClick={onUnpublish}
                        disabled={busy}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-card px-5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
                      >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {t('unpublish')}
                      </button>
                    ) : (
                      <DialogPrimitive.Close className="inline-flex min-h-11 items-center rounded-full border border-border-strong bg-card px-5 text-sm font-medium text-foreground transition hover:bg-muted">
                        {t('keepEditing')}
                      </DialogPrimitive.Close>
                    )}
                    {!isPublished && (
                      <button
                        type="button"
                        onClick={onPublish}
                        disabled={busy || blocked}
                        className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {blocked ? t('fixFirst') : t('publish')}
                      </button>
                    )}
                  </div>
                </footer>
              </m.section>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
