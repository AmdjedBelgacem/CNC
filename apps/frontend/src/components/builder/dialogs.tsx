'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Rocket, RotateCcw, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { builderActions } from './builder-actions';
import { useBuilderUI } from './builder-ui-store';
import { deleteSavedSection, renameSavedSection, saveSection } from '@/lib/builder/saved-sections';
import { toast } from '@/components/ui/toast'; /** * Apple-style dialogs replacing window.prompt/confirm: * publish note, page reset, and saved-section save/rename/delete. */
export function BuilderDialogs() {
  const tb = useTranslations('builder');
  const publishOpen = useBuilderUI((s) => s.publishOpen);
  const setPublishOpen = useBuilderUI((s) => s.setPublishOpen);
  const resetOpen = useBuilderUI((s) => s.resetOpen);
  const setResetOpen = useBuilderUI((s) => s.setResetOpen);
  const saving = useBuilderUI((s) => s.saving);
  const [note, setNote] = useState('');
  return (
    <>
      {' '}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        {' '}
        <DialogContent className="max-h-[calc(100dvh_-_4rem)] max-w-md overflow-y-auto">
          {' '}
          <DialogHeader>
            {' '}
            <DialogTitle className="flex items-center gap-2">
              {' '}
              <Rocket className="size-4 text-primary" />{' '}
              {tb('dialogs.publishTitle', { default: 'Publish this page' })}{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          <div className="-mt-2 space-y-4">
            {' '}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tb('dialogs.publishDescription', {
                default:
                  'Publishing makes the current draft live for visitors. A version snapshot is kept for history and rollback.',
              })}{' '}
            </p>{' '}
            <label className="block">
              {' '}
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {tb('dialogs.releaseNoteLabel', { default: 'Release note (optional)' })}
              </span>{' '}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tb('dialogs.releaseNotePlaceholder', {
                  default: 'What changed in this version?',
                })}
                className="h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />{' '}
            </label>{' '}
          </div>{' '}
          <div className="mt-4 flex justify-end gap-2">
            {' '}
            <DialogClose asChild>
              {' '}
              <Button variant="ghost" size="sm">
                {tb('dialogs.cancel', { default: 'Cancel' })}
              </Button>{' '}
            </DialogClose>{' '}
            <Button
              size="sm"
              disabled={saving}
              onClick={() => {
                builderActions.current?.publish(note.trim() || undefined);
                setNote('');
                setPublishOpen(false);
              }}
            >
              {' '}
              <Rocket className="me-1.5 size-3.5" />{' '}
              {tb('dialogs.publish', { default: 'Publish' })}{' '}
            </Button>{' '}
          </div>{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        {' '}
        <DialogContent className="max-h-[calc(100dvh_-_4rem)] max-w-md overflow-y-auto">
          {' '}
          <DialogHeader>
            {' '}
            <DialogTitle className="flex items-center gap-2">
              {' '}
              <RotateCcw className="size-4 text-destructive" />{' '}
              {tb('dialogs.resetTitle', { default: 'Reset page?' })}{' '}
            </DialogTitle>{' '}
          </DialogHeader>{' '}
          <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
            {tb('dialogs.resetDescription', {
              default:
                'The current draft will be replaced with the default layout. Your latest published version is unaffected.',
            })}{' '}
          </p>{' '}
          <div className="mt-4 flex justify-end gap-2">
            {' '}
            <DialogClose asChild>
              {' '}
              <Button variant="ghost" size="sm">
                {tb('dialogs.cancel', { default: 'Cancel' })}
              </Button>{' '}
            </DialogClose>{' '}
            <Button
              size="sm"
              variant="destructive"
              disabled={saving}
              onClick={() => {
                builderActions.current?.reset();
                setResetOpen(false);
              }}
            >
              {' '}
              {tb('dialogs.resetAction', { default: 'Reset page' })}{' '}
            </Button>{' '}
          </div>{' '}
        </DialogContent>{' '}
      </Dialog>{' '}
      <SectionDialog />{' '}
    </>
  );
}
function SectionDialog() {
  const tb = useTranslations('builder');
  const dialog = useBuilderUI((s) => s.sectionDialog);
  const setSectionDialog = useBuilderUI((s) => s.setSectionDialog);
  const [name, setName] = useState('');
  useEffect(() => {
    if (dialog?.mode === 'save') setName(dialog.suggested);
    else if (dialog?.mode === 'rename') setName(dialog.name);
  }, [dialog]);
  if (!dialog) return null;
  const isDelete = dialog.mode === 'delete';
  const title =
    dialog.mode === 'save'
      ? tb('dialogs.sectionSaveTitle', { default: 'Save reusable section' })
      : dialog.mode === 'rename'
        ? tb('dialogs.sectionRenameTitle', { default: 'Rename section' })
        : tb('dialogs.sectionDeleteTitle', { default: 'Delete section' });
  const confirm = async () => {
    try {
      if (dialog.mode === 'save') {
        await saveSection(name.trim(), dialog.node);
        toast({
          type: 'ok',
          title: tb('dialogs.sectionSaved', { default: 'Section saved' }),
          description: tb('dialogs.sectionSavedDetail', {
            name: name.trim(),
            default: `Saved "${name.trim()}"`,
          }),
        });
      } else if (dialog.mode === 'rename') {
        await renameSavedSection(dialog.id, name.trim());
        toast({
          type: 'ok',
          title: tb('dialogs.sectionRenamed', { default: 'Section renamed' }),
          description: tb('dialogs.sectionRenamedDetail', {
            name: name.trim(),
            default: `Renamed to "${name.trim()}"`,
          }),
        });
      } else {
        await deleteSavedSection(dialog.id);
        toast({
          type: 'ok',
          title: tb('dialogs.sectionDeleted', { default: 'Section deleted' }),
        });
      }
    } catch (e) {
      toast({
        type: 'err',
        title: tb('dialogs.failed', { default: 'Failed' }),
        description:
          e instanceof Error
            ? e.message
            : tb('dialogs.somethingWentWrong', { default: 'Something went wrong' }),
      });
    } finally {
      setSectionDialog(null);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && setSectionDialog(null)}>
      {' '}
      <DialogContent className="max-h-[calc(100dvh_-_4rem)] max-w-md overflow-y-auto">
        {' '}
        <DialogHeader>
          {' '}
          <DialogTitle className="flex items-center gap-2">
            {' '}
            {dialog.mode === 'delete' ? (
              <Trash2 className="size-4 text-destructive" />
            ) : dialog.mode === 'rename' ? (
              <Pencil className="size-4 text-primary" />
            ) : (
              <FolderPlus className="size-4 text-primary" />
            )}{' '}
            {title}{' '}
          </DialogTitle>{' '}
        </DialogHeader>{' '}
        {isDelete ? (
          <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
            {tb('dialogs.deleteConfirm', {
              name: dialog.name,
              default: `Delete saved section “${dialog.name}”? This cannot be undone.`,
            })}{' '}
          </p>
        ) : (
          <div className="-mt-2">
            {' '}
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              {dialog.mode === 'save'
                ? tb('dialogs.saveDescription', {
                    default:
                      'Saves the selected Section container (and everything inside it) as a reusable block you can insert anywhere.',
                  })
                : tb('dialogs.renameDescription', {
                    default: 'Choose a new name for this saved section.',
                  })}{' '}
            </p>{' '}
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void confirm();
              }}
              placeholder={tb('dialogs.sectionNamePlaceholder', { default: 'Section name' })}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />{' '}
          </div>
        )}{' '}
        <div className="mt-4 flex justify-end gap-2">
          {' '}
          <DialogClose asChild>
            {' '}
            <Button variant="ghost" size="sm">
              {tb('dialogs.cancel', { default: 'Cancel' })}
            </Button>{' '}
          </DialogClose>{' '}
          <Button
            size="sm"
            variant={isDelete ? 'destructive' : 'default'}
            disabled={!isDelete && !name.trim()}
            onClick={() => void confirm()}
          >
            {' '}
            {isDelete
              ? tb('dialogs.delete', { default: 'Delete' })
              : dialog.mode === 'save'
                ? tb('dialogs.saveSection', { default: 'Save section' })
                : tb('dialogs.rename', { default: 'Rename' })}{' '}
          </Button>{' '}
        </div>{' '}
      </DialogContent>{' '}
    </Dialog>
  );
}
