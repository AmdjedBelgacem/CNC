'use client';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease, spring } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFormGuard, useJustSaved } from './form-page';

/* -----------------------------------------------------------------------------
 * Drawer kit — the pieces every admin edit drawer / dialog shares, so that the
 * behaviour matches the page-level SaveDock (docs/design/ADMIN_FORMS.md):
 *
 *   const guard = useDirtyClose(dirty, onClose);
 *   <Modal onClose={guard.requestClose}> … <DrawerFooter … /> </Modal>
 *   <DiscardChangesDialog guard={guard} />
 *
 * Drawers do not use FormLayout / AdminCommandBar / SaveDock; the footer below
 * is the in-drawer equivalent and has the same states.
 * --------------------------------------------------------------------------- */

/** Closing a dirty drawer (Esc, overlay, close button) asks before discarding. */
export function useDirtyClose(dirty: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) setConfirming(true);
    else onClose();
  }, [dirty, onClose]);
  return {
    confirming,
    requestClose,
    keepEditing: () => setConfirming(false),
    discard: () => {
      setConfirming(false);
      onClose();
    },
  };
}

export type DirtyClose = ReturnType<typeof useDirtyClose>;

export function DiscardChangesDialog({ guard }: { guard: DirtyClose }) {
  const t = useTranslations('ui.adminForm');
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={guard.confirming} onOpenChange={(open) => !open && guard.keepEditing()}>
      <DialogContent
        size="sm"
        hideClose
        title={t('discardTitle')}
        onOpenAutoFocus={(event) => {
          // Land on the safe choice, not the destructive one.
          event.preventDefault();
          keepRef.current?.focus();
        }}
      >
        <DialogHeader className="pe-5 sm:pe-7">
          <DialogTitle>{t('discardTitle')}</DialogTitle>
          <DialogDescription>{t('discardBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="destructive" onClick={guard.discard}>
            {t('discardConfirm')}
          </Button>
          <Button type="button" variant="outline" onClick={guard.keepEditing} ref={keepRef}>
            {t('keepEditing')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sticky drawer footer: status on the start side, Discard / Save on the end.
 * Place it as the last child of the Modal body so it sticks to the bottom of the
 * scrolling area. ⌘S and the beforeunload guard come with it.
 *
 * - `editable=false`: nothing to save here, only a Close button is shown.
 * - `create`: Save is the create action, disabled until `canSave`; the status line
 *   reads "Ready to create" / "Fill in the required fields" instead of "Saved".
 */
export function DrawerFooter({
  dirty = false,
  saving = false,
  failed = false,
  canSave = true,
  editable = true,
  create = false,
  onSave,
  onDiscard,
  onClose,
  saveLabel,
  extra,
  className,
}: {
  dirty?: boolean;
  saving?: boolean;
  failed?: boolean;
  canSave?: boolean;
  editable?: boolean;
  create?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  onClose: () => void;
  saveLabel?: ReactNode;
  /** Secondary actions (Duplicate, Delete…) shown before the status, separated from Save. */
  extra?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('ui.adminForm');
  const tc = useTranslations('common');
  const justSaved = useJustSaved(saving, failed);
  useFormGuard({ dirty: editable && !create && dirty && canSave, saving, onSave });
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const status = saving ? 'saving' : justSaved ? 'saved' : create ? 'create' : dirty ? 'dirty' : 'clean';
  const swap = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: ease.emerge } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.1, ease: ease.exit } },
  };

  return (
    <div
      role="region"
      aria-label={t('actions')}
      className={cn(
        'sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 bg-card/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-xl sm:px-6',
        className,
      )}
    >
      {extra ? (
        <>
          <div className="flex items-center gap-1">{extra}</div>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-13" aria-live="polite">
        {editable ? (
          <AnimatePresence mode="wait" initial={false}>
            {status === 'saving' ? (
              <m.span key="saving" {...swap} className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {tc('saving')}
              </m.span>
            ) : status === 'saved' ? (
              <m.span key="saved" {...swap} className="inline-flex items-center gap-2 font-medium text-success">
                <m.span
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={spring.snappy}
                  className="flex size-4 items-center justify-center rounded-full bg-success text-success-foreground"
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </m.span>
                {t('savedJustNow')}
              </m.span>
            ) : status === 'create' ? (
              <m.span key="create" {...swap} className="truncate text-muted-foreground">
                {canSave ? t('readyToCreate') : t('fillRequired')}
              </m.span>
            ) : status === 'dirty' ? (
              <m.span key="dirty" {...swap} className="inline-flex items-center gap-2 font-medium text-warning">
                <span className="relative flex size-1.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-warning" />
                </span>
                {t('unsavedChanges')}
              </m.span>
            ) : (
              <m.span key="clean" {...swap} className="truncate text-muted-foreground">
                {t('allChangesSaved')}
              </m.span>
            )}
          </AnimatePresence>
        ) : null}
      </div>

      {editable ? (
        <div className="flex items-center gap-2">
          {create ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              {tc('cancel')}
            </Button>
          ) : dirty ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
              {t('discard')}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {tc('close')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving || !canSave || (!create && !dirty)}
          >
            {saveLabel ?? tc('saveChanges')}
            {!create && (
              <kbd className="hidden rounded border border-primary-foreground/30 px-1 font-sans text-2xs text-primary-foreground/80 sm:inline">
                {isMac ? '⌘S' : 'Ctrl S'}
              </kbd>
            )}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {tc('close')}
        </Button>
      )}
    </div>
  );
}
