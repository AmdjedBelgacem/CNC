'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleHelp,
  Eye,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { ContentLocale, InteractiveHotspot, LessonBlock, LessonContentDocument, QuizQuestion } from '@titan/shared';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import * as api from './api';
import { LessonBlockRenderer } from '@/components/learning/lesson-block-renderer';
import {
  cloneDocument,
  isValidDocument,
  localizedContent,
  makeBlock,
  makeHotspot,
  makeId,
  makeOption,
  makeQuestion,
  sortDocument,
  withLocalizedValue,
  type BlockContent,
} from '@/lib/lesson-blocks';

const inputClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10';
const textareaClass = 'min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10';
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

// English stays here; the render site translates with the English as the default.
const BLOCK_LABELS: Record<LessonBlock['type'], { key: string; fallback: string }> = {
  video: { key: 'studio.blockVideo', fallback: 'Video' },
  rich_text: { key: 'studio.blockRichText', fallback: 'Rich text' },
  interactive_image: { key: 'studio.blockInteractiveImage', fallback: 'Interactive image' },
  quiz: { key: 'studio.blockQuiz', fallback: 'Quiz' },
};

function readFileAsDataUrl(file: File, errorMessage = 'Could not read file'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(file);
  });
}

function blockLabel(
  type: LessonBlock['type'],
  t: (key: string, values: { default: string }) => string,
) {
  const entry = BLOCK_LABELS[type] ?? BLOCK_LABELS.quiz;
  return t(entry.key, { default: entry.fallback });
}

export function LessonBlockEditor({
  lessonId,
  initialDocument,
  locale: initialLocale,
  videoUrl,
  onDocumentChange,
}: {
  lessonId: string;
  initialDocument?: LessonContentDocument | null;
  locale: ContentLocale;
  videoUrl?: string | null;
  onDocumentChange?: (document: LessonContentDocument) => void;
}) {
  const [document, setDocument] = useState<LessonContentDocument>(sortDocument(cloneDocument(initialDocument)));
  const t = useTranslations('courses');
  const tMedia = useTranslations('media');
  const tCommon = useTranslations('common');
  const [selectedId, setSelectedId] = useState<string | null>(() => initialDocument?.blocks[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [locale, setLocale] = useState<ContentLocale>(initialLocale);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentRef = useRef(document);
  const versionRef = useRef(0);
  const initialDocumentRef = useRef(initialDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);
  initialDocumentRef.current = initialDocument;

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  const persist = useCallback(async (next: LessonContentDocument, version: number) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await api.replaceLessonBlocks(lessonId, next);
    } catch {
      try {
        await api.updateLesson(lessonId, { contentBlocks: next });
      } catch (error) {
        setSaveState('error');
        setSaveError(error instanceof Error ? error.message : t('studio.saveBlocksFailed', { default: 'The lesson blocks could not be saved.' }));
        return;
      }
    }
    if (version === versionRef.current) setSaveState('saved');
  }, [lessonId, t]);

  const commit = useCallback((next: LessonContentDocument) => {
    const normalized = sortDocument(cloneDocument(next));
    documentRef.current = normalized;
    setDocument(normalized);
    onDocumentChange?.(normalized);
    versionRef.current += 1;
    setSaveState('dirty');
    setSaveError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    const version = versionRef.current;
    timerRef.current = setTimeout(() => void persist(normalized, version), 800);
  }, [onDocumentChange, persist]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await api.getLessonBlocks(lessonId);
        if (cancelled) return;
        const next = sortDocument(cloneDocument(result));
        documentRef.current = next;
        setDocument(next);
        setSelectedId(next.blocks[0]?.id ?? null);
        setSaveState('saved');
      } catch {
        if (cancelled) return;
        const fallback = sortDocument(cloneDocument(initialDocumentRef.current));
        documentRef.current = fallback;
        setDocument(fallback);
        setSelectedId(fallback.blocks[0]?.id ?? null);
        setSaveState('error');
        setSaveError(t('studio.editorFallback', { default: 'Using the lesson editor fallback. Save will retry the block API.' }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (isValidDocument(documentRef.current)) void persist(documentRef.current, versionRef.current);
      }
    };
    }, [lessonId, persist, t]);

  const saveNow = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isValidDocument(documentRef.current)) {
      setSaveState('error');
      setSaveError(t('studio.incompleteFields', { default: 'Complete the highlighted block fields before saving.' }));
      toast({ type: 'err', title: t('studio.incompleteTitle', { default: 'Block document is incomplete' }), description: t('studio.incompleteHint', { default: 'Video, image, and quiz blocks need valid content.' }) });
      return;
    }
    await persist(documentRef.current, versionRef.current);
  };

  const selected = document.blocks.find((block) => block.id === selectedId) ?? null;
  const localized = selected ? localizedContent(selected, locale) : null;

  const updateBlock = (id: string, updater: (block: LessonBlock) => LessonBlock) => {
    commit({ ...documentRef.current, blocks: documentRef.current.blocks.map((block) => block.id === id ? updater(block) : block) });
  };

  const setBaseField = (field: string, value: unknown) => {
    if (!selected) return;
    updateBlock(selected.id, (block) => ({ ...block, content: { ...(block.content as BlockContent), [field]: value } }));
  };

  const setLocalizedField = (field: string, value: unknown) => {
    if (!selected) return;
    updateBlock(selected.id, (block) => withLocalizedValue(block, locale, field, value));
  };

  const addBlock = (type: LessonBlock['type']) => {
    const block = makeBlock(type, documentRef.current.blocks.length);
    commit({ ...documentRef.current, blocks: [...documentRef.current.blocks, block] });
    setSelectedId(block.id);
  };

  const moveBlockTo = (sourceId: string | null, targetId: string) => {
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      return;
    }
    const blocks = [...documentRef.current.blocks];
    const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
    const targetIndex = blocks.findIndex((block) => block.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingId(null);
      return;
    }
    const [moving] = blocks.splice(sourceIndex, 1);
    if (moving) blocks.splice(targetIndex, 0, moving);
    commit({ ...documentRef.current, blocks });
    setDraggingId(null);
  };

  const removeBlock = (id: string) => {
    const next = { ...documentRef.current, blocks: documentRef.current.blocks.filter((block) => block.id !== id) };
    commit(next);
    if (selectedId === id) setSelectedId(next.blocks[0]?.id ?? null);
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    const blocks = [...documentRef.current.blocks];
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const current = blocks[index];
    const replacement = blocks[target];
    if (!current || !replacement) return;
    blocks[index] = replacement;
    blocks[target] = current;
    commit({ ...documentRef.current, blocks });
  };

  const updateQuestions = (questions: QuizQuestion[], localizedValue = true) => {
    if (!selected) return;
    if (localizedValue && locale !== 'en') setLocalizedField('questions', questions);
    else setBaseField('questions', questions);
  };

  const updateQuestion = (questionId: string, patch: Partial<QuizQuestion>, localizedValue = true) => {
    if (!localized || !selected) return;
    const localizedQuestions = (localized.questions as QuizQuestion[] | undefined) ?? [];
    const nextLocalizedQuestions = localizedQuestions.map((question) => question.id === questionId ? { ...question, ...patch } : question);
    const baseQuestions = ((selected.content as BlockContent).questions as QuizQuestion[] | undefined) ?? [];
    if (!localizedValue) {
      setBaseField('questions', baseQuestions.map((question) => question.id === questionId ? { ...question, ...patch } : question));
      return;
    }
    if (locale === 'en') {
      setBaseField('questions', nextLocalizedQuestions);
      return;
    }
    const structuralPatch = {
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.correctOptionIds !== undefined ? { correctOptionIds: patch.correctOptionIds } : {}),
      ...(patch.points !== undefined ? { points: patch.points } : {}),
    };
    const translatedPatch = Object.fromEntries(
      Object.entries(patch).filter(([key]) => !['type', 'correctOptionIds', 'points'].includes(key)),
    );
    updateBlock(selected.id, (block) => {
      const nextBaseQuestions = baseQuestions.map((question) => question.id === questionId ? { ...question, ...structuralPatch } : question);
      const nextBlock: LessonBlock = { ...block, content: { ...(block.content as BlockContent), questions: nextBaseQuestions } as LessonBlock['content'] };
      if (Object.keys(translatedPatch).length > 0) {
        nextBlock.translations = {
          ...(block.translations ?? {}),
          [locale]: {
            ...(block.translations?.[locale] ?? {}),
            questions: nextLocalizedQuestions,
          },
        };
      }
      return nextBlock;
    });
  };

  const addQuestion = () => {
    const currentQuestions = locale === 'en' ? ((localized?.questions as QuizQuestion[] | undefined) ?? []) : (((selected?.content as BlockContent | undefined)?.questions as QuizQuestion[] | undefined) ?? []);
    const questions = [...currentQuestions, makeQuestion(currentQuestions.length + 1)];
    updateQuestions(questions, false);
  };

  const removeQuestion = (questionId: string) => {
    const currentQuestions = locale === 'en' ? ((localized?.questions as QuizQuestion[] | undefined) ?? []) : (((selected?.content as BlockContent | undefined)?.questions as QuizQuestion[] | undefined) ?? []);
    updateQuestions(currentQuestions.filter((question) => question.id !== questionId), false);
  };

  const addOption = (question: QuizQuestion) => updateQuestion(question.id, { options: [...question.options, makeOption(`Option ${question.options.length + 1}`)] }, false);
  const removeOption = (question: QuizQuestion, optionId: string) => {
    const options = question.options.filter((option) => option.id !== optionId);
    const correctOptionIds = (question.correctOptionIds ?? []).filter((id) => id !== optionId);
    updateQuestion(question.id, { options, correctOptionIds }, false);
  };
  const setCorrectOption = (question: QuizQuestion, optionId: string, selected: boolean) => {
    const current = question.correctOptionIds ?? [];
    const correctOptionIds = question.type === 'multiple'
      ? selected ? [...new Set([...current, optionId])] : current.filter((id) => id !== optionId)
      : [optionId];
    updateQuestion(question.id, { correctOptionIds }, false);
  };

  const updateHotspots = (hotspots: InteractiveHotspot[]) => setLocalizedField('hotspots', hotspots);

  const uploadMedia = async (
    file: File | null | undefined,
    folder: 'lessons' | 'lesson-images' | 'captions',
    apply: (url: string) => void,
  ) => {
    if (!file) return;
    const valid = folder === 'lessons'
      ? file.type.startsWith('video/')
      : folder === 'captions'
        ? file.type === 'text/vtt' || file.type === 'text/plain'
        : file.type.startsWith('image/');
    if (!valid) {
      toast({ type: 'err', title: t('studio.unsupportedFile', { default: 'Unsupported file' }), description: t('studio.unsupportedFileHint', { default: 'Choose a supported media file.' }) });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, tMedia('couldNotReadFile', { default: 'Could not read file' }));
      const result = await api.uploadFile(dataUrl, folder, file.name);
      apply(result.url);
      toast({ type: 'ok', title: t('studio.mediaUploaded', { default: 'Media uploaded' }) });
    } catch (error) {
      toast({ type: 'err', title: t('studio.uploadFailed', { default: 'Upload failed' }), description: error instanceof Error ? error.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (file?: File | null) => {
    void uploadMedia(file, 'lesson-images', (url) => setBaseField('src', url));
  };
  const handleVideoUpload = (file?: File | null) => {
    void uploadMedia(file, 'lessons', (url) => setBaseField('source', url));
  };
  const handlePosterUpload = (file?: File | null) => {
    void uploadMedia(file, 'lesson-images', (url) => setBaseField('posterUrl', url));
  };
  const handleCaptionsUpload = (file?: File | null) => {
    void uploadMedia(file, 'captions', (url) => setBaseField('captionsUrl', url));
  };
  const handleRichImageUpload = (index: number, file?: File | null) => {
    void uploadMedia(file, 'lesson-images', (url) => {
      const current = (localized?.images as { src: string; alt: string; caption?: string | null }[] | undefined) ?? [];
      setLocalizedField('images', current.map((item, itemIndex) => itemIndex === index ? { ...item, src: url } : item));
    });
  };

  const blockList = document.blocks;
  const questions = (localized?.questions as QuizQuestion[] | undefined) ?? [];
  const images = (localized?.images as { src: string; alt: string; caption?: string | null }[] | undefined) ?? [];
  const hotspots = (localized?.hotspots as InteractiveHotspot[] | undefined) ?? [];
  const placeHotspot = (x: number, y: number) => {
    const hotspot = makeHotspot(hotspots.length, x, y);
    updateHotspots([...hotspots, hotspot]);
    return hotspot;
  };

  return (
    <section className="space-y-5" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold text-foreground">{t('studio.lessonBlocks', { default: 'Lesson blocks' })}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('studio.lessonBlocksHint', { default: 'Build a lesson from video, rich text, interactive images, and server-graded quizzes.' })}</p></div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-lg border border-border bg-background p-1" role="group" aria-label={t('studio.blockContentLanguage', { default: 'Block content language' })}>
            {(['en', 'ar'] as ContentLocale[]).map((item) => <button key={item} type="button" onClick={() => setLocale(item)} className={cn('rounded-md px-2.5 py-1.5 text-xs font-semibold', locale === item ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>{item === 'ar' ? 'العربية' : 'English'}</button>)}
          </div>
          <button type="button" onClick={() => setPreview((value) => !value)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold', preview ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground')}><Eye className="size-3.5" />{preview ? t('studio.editing', { default: 'Editing' }) : tCommon('preview', { default: 'Preview' })}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : preview ? (
        <div className="rounded-2xl border border-border bg-background p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('studio.liveBlockPreview', { default: 'Live block preview' })}</p><span className="text-xs text-muted-foreground">{locale === 'ar' ? 'RTL' : 'LTR'}</span></div><LessonBlockRenderer blocks={document} locale={locale} videoUrl={videoUrl} preview /></div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(['video', 'rich_text', 'interactive_image', 'quiz'] as LessonBlock['type'][]).map((type) => <button key={type} type="button" onClick={() => addBlock(type)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/5"><Plus className="size-3.5 text-primary" />{blockLabel(type, t)}</button>)}
          </div>
          {blockList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center"><FileText className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold text-foreground">{t('studio.startWithBlock', { default: 'Start with a learning block' })}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t('studio.startWithBlockHint', { default: 'Add a video, written explanation, image exploration, or quiz. Changes autosave to this lesson.' })}</p></div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                {blockList.map((block, index) => <button key={block.id} type="button" draggable aria-grabbed={draggingId === block.id} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggingId(block.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveBlockTo(draggingId, block.id); }} onDragEnd={() => setDraggingId(null)} onClick={() => setSelectedId(block.id)} className={cn('flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-start transition', selectedId === block.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40', draggingId === block.id && 'opacity-50')}><GripVertical className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-foreground">{blockLabel(block.type, t)}</span><span className="block truncate text-[11px] text-muted-foreground">{block.type === 'rich_text' ? String((block.content as BlockContent).text || t('studio.emptyTextBlock', { default: 'Empty text block' })).slice(0, 30) : `${block.type === 'quiz' ? ((block.content as BlockContent).questions as unknown[] | undefined)?.length ?? 0 : ''}`}</span></span><span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span></button>)}
              </div>
              <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
                {!selected ? <p className="py-10 text-center text-sm text-muted-foreground">{t('studio.selectBlock', { default: 'Select a block to edit.' })}</p> : <BlockFields key={selected.id} block={selected} content={localized ?? {}} locale={locale} images={images} hotspots={hotspots} questions={questions} uploading={uploading} fileInputRef={fileInputRef} onBaseField={setBaseField} onLocalizedField={setLocalizedField} onMove={(direction) => moveBlock(selected.id, direction)} onRemove={() => removeBlock(selected.id)} onAddQuestion={addQuestion} onRemoveQuestion={removeQuestion} onUpdateQuestion={updateQuestion} onAddOption={addOption} onRemoveOption={removeOption} onSetCorrect={setCorrectOption} onUpdateHotspots={updateHotspots} onPlaceHotspot={placeHotspot} onImageUpload={handleImageUpload} onVideoUpload={handleVideoUpload} onPosterUpload={handlePosterUpload} onCaptionsUpload={handleCaptionsUpload} onRichImageUpload={handleRichImageUpload} />}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">{saveState === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : saveState === 'saved' ? <Check className="size-3.5 text-success" /> : saveState === 'error' ? <CircleHelp className="size-3.5 text-destructive" /> : <Save className="size-3.5" />}{saveState === 'saving' ? t('studio.savingBlocks', { default: 'Saving blocks…' }) : saveState === 'saved' ? t('studio.blocksSaved', { default: 'Blocks saved' }) : saveState === 'error' ? saveError : saveState === 'dirty' ? tCommon('unsavedChanges', { default: 'Unsaved changes' }) : t('studio.autosaveReady', { default: 'Autosave ready' })}</div>
            <button type="button" onClick={() => void saveNow()} disabled={saveState === 'saving'} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-50"><Save className="size-3.5" />{t('studio.saveBlocks', { default: 'Save blocks' })}</button>
          </div>
        </>
      )}
    </section>
  );
}

function HotspotPlacementSurface({
  src,
  alt,
  hotspots,
  selectedHotspotId,
  placing,
  onToggle,
  onPlace,
  onSelectHotspot,
}: {
  src: string;
  alt: string;
  hotspots: InteractiveHotspot[];
  selectedHotspotId: string | null;
  placing: boolean;
  onToggle: () => void;
  onPlace: (x: number, y: number) => void;
  onSelectHotspot: (id: string) => void;
}) {
  const t = useTranslations('courses');
  const tCommon = useTranslations('common');
  if (!src) return null;

  const handleImageClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!placing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    onPlace(Number(x.toFixed(2)), Number(y.toFixed(2)));
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t('studio.placeHotspots', { default: 'Place hotspots on the image' })}</p>
        <button type="button" onClick={onToggle} className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', placing ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground')}>
          {placing ? tCommon('cancel', { default: 'Cancel' }) : t('studio.placeHotspot', { default: 'Place hotspot' })}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
        <img src={src} alt={alt} className="block max-h-[28rem] w-full object-contain" />
        {placing && (
          <button type="button" onClick={handleImageClick} className="absolute inset-0 cursor-crosshair bg-primary/10" aria-label={t('studio.clickToPlaceHotspot', { default: 'Click to place hotspot' })} />
        )}
        {hotspots.map((hotspot, index) => (
          <button
            key={hotspot.id}
            type="button"
            onClick={(event) => { event.stopPropagation(); onSelectHotspot(hotspot.id); }}
            aria-label={t('studio.hotspotNumber', { number: index + 1, default: 'Hotspot {number}' })}
            className={cn('absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-primary-foreground shadow-lg transition', selectedHotspotId === hotspot.id ? 'bg-primary ring-4 ring-primary/30' : 'bg-primary/80 hover:bg-primary')}
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('studio.hotspotHint', { default: 'Click the image to place a marker, then edit its label and details below.' })}</p>
    </div>
  );
}

function MediaUploadField({
  label,
  accept,
  value,
  uploading,
  onUpload,
}: {
  label: string;
  accept: string;
  value: string;
  uploading: boolean;
  onUpload: (file?: File | null) => void;
}) {
  const t = useTranslations('courses');
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? t('studio.uploading', { default: 'Uploading…' }) : value ? t('studio.replaceUploadedFile', { default: 'Replace uploaded file' }) : t('studio.chooseFileToUpload', { default: 'Choose file to upload' })}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            onUpload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      {value && <p className="mt-1 text-xs text-muted-foreground">{t('studio.uploadedFileAttached', { default: 'Uploaded file attached' })}</p>}
    </div>
  );
}

function BlockFields({
  block,
  content,
  locale,
  images,
  hotspots,
  questions,
  uploading,
  fileInputRef,
  onBaseField,
  onLocalizedField,
  onMove,
  onRemove,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onAddOption,
  onRemoveOption,
  onSetCorrect,
  onUpdateHotspots,
  onPlaceHotspot,
  onImageUpload,
  onVideoUpload,
  onPosterUpload,
  onCaptionsUpload,
  onRichImageUpload,
}: {
  block: LessonBlock;
  content: BlockContent;
  locale: ContentLocale;
  images: { src: string; alt: string; caption?: string | null }[];
  hotspots: InteractiveHotspot[];
  questions: QuizQuestion[];
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onBaseField: (field: string, value: unknown) => void;
  onLocalizedField: (field: string, value: unknown) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (id: string) => void;
  onUpdateQuestion: (id: string, patch: Partial<QuizQuestion>, localized?: boolean) => void;
  onAddOption: (question: QuizQuestion) => void;
  onRemoveOption: (question: QuizQuestion, optionId: string) => void;
  onSetCorrect: (question: QuizQuestion, optionId: string, selected: boolean) => void;
  onUpdateHotspots: (hotspots: InteractiveHotspot[]) => void;
  onPlaceHotspot: (x: number, y: number) => InteractiveHotspot;
  onImageUpload: (file?: File | null) => void;
  onVideoUpload: (file?: File | null) => void;
  onPosterUpload: (file?: File | null) => void;
  onCaptionsUpload: (file?: File | null) => void;
  onRichImageUpload: (index: number, file?: File | null) => void;
}) {
  const [placingHotspot, setPlacingHotspot] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(hotspots[0]?.id ?? null);
  const t = useTranslations('courses');
  const tLesson = useTranslations('lesson');
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4"><div><p className="text-sm font-semibold text-foreground">{blockLabel(block.type, t)}</p><p className="mt-0.5 text-xs text-muted-foreground">{t('studio.editingContent', { language: locale === 'ar' ? 'العربية' : 'English', default: 'Editing {language} content' })}</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => onMove(-1)} aria-label={t('studio.moveBlockUp', { default: 'Move block up' })} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowUp className="size-4" /></button><button type="button" onClick={() => onMove(1)} aria-label={t('studio.moveBlockDown', { default: 'Move block down' })} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDown className="size-4" /></button><button type="button" onClick={onRemove} aria-label={t('studio.deleteBlock', { default: 'Delete block' })} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button></div></div>
      {block.type === 'video' && (
        <div className="space-y-4">
          <MediaUploadField label={t('studio.videoFile', { default: 'Video file' })} accept="video/*" value={String(content.source ?? content.storageKey ?? '')} uploading={uploading} onUpload={onVideoUpload} />
          <div className="grid gap-4 sm:grid-cols-2">
            <MediaUploadField label={t('studio.posterImage', { default: 'Poster image' })} accept="image/*" value={String(content.posterUrl ?? '')} uploading={uploading} onUpload={onPosterUpload} />
            <MediaUploadField label={t('studio.captionsFile', { default: 'Captions file' })} accept=".vtt,text/vtt,text/plain" value={String(content.captionsUrl ?? '')} uploading={uploading} onUpload={onCaptionsUpload} />
          </div>
          <div>
            <label className={labelClass} htmlFor="block-video-transcript">{tLesson('transcript', { default: 'Transcript' })}</label>
            <textarea id="block-video-transcript" value={String(content.transcript ?? '')} onChange={(event) => onLocalizedField('transcript', event.target.value)} className={textareaClass} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
          </div>
        </div>
      )}
      {block.type === 'rich_text' && <div className="space-y-4"><div><label className={labelClass} htmlFor="block-rich-content">{t('studio.content', { default: 'Content' })}</label><textarea id="block-rich-content" value={String(content.text ?? '')} onChange={(event) => onLocalizedField('text', event.target.value)} className={textareaClass} dir={locale === 'ar' ? 'rtl' : 'ltr'} placeholder={t('studio.writeExplanation', { default: 'Write a concise explanation…' })} /></div><div className="space-y-3"><div className="flex items-center justify-between"><label className={labelClass}>{t('studio.images', { default: 'Images' })}</label><button type="button" onClick={() => onLocalizedField('images', [...images, { src: '', alt: '', caption: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3.5" />{t('studio.addImage', { default: 'Add image' })}</button></div>{images.map((image, index) => <div key={`${image.src}-${index}`} className="grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]"><label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground sm:col-span-1">
                {image.src ? t('studio.replaceUploadedImage', { default: 'Replace uploaded image' }) : t('studio.chooseImage', { default: 'Choose image' })}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => { onRichImageUpload(index, event.target.files?.[0]); event.target.value = ''; }} />
              </label><input value={image.alt} onChange={(event) => onLocalizedField('images', images.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item))} placeholder={t('studio.altText', { default: 'Alt text' })} className={inputClass} /><button type="button" onClick={() => onLocalizedField('images', images.filter((_, itemIndex) => itemIndex !== index))} aria-label={t('studio.removeImage', { default: 'Remove image' })} className="self-center rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="size-4" /></button><input value={image.caption ?? ''} onChange={(event) => onLocalizedField('images', images.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item))} placeholder={t('studio.caption', { default: 'Caption' })} className={cn(inputClass, 'sm:col-span-3')} /></div>)}</div></div>}
      {block.type === 'interactive_image' && <div className="space-y-5"><div><label className={labelClass} htmlFor="block-image-src">{t('studio.baseImage', { default: 'Base image' })}</label><div className="flex gap-2"><span className="flex min-h-10 flex-1 items-center rounded-lg border border-dashed border-border bg-background px-3 text-sm text-muted-foreground">{content.src ? t('studio.uploadedImageReady', { default: 'Uploaded image ready' }) : t('studio.uploadImageForHotspots', { default: 'Upload an image to place hotspots' })}</span><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { onImageUpload(event.target.files?.[0]); event.target.value = ''; }} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}</button></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass} htmlFor="block-image-alt">{t('studio.altText', { default: 'Alt text' })}</label><input id="block-image-alt" value={String(content.alt ?? '')} onChange={(event) => onLocalizedField('alt', event.target.value)} className={inputClass} /></div><div><label className={labelClass} htmlFor="block-image-caption">{t('studio.caption', { default: 'Caption' })}</label><input id="block-image-caption" value={String(content.caption ?? '')} onChange={(event) => onLocalizedField('caption', event.target.value)} className={inputClass} /></div></div><HotspotPlacementSurface src={String(content.src ?? '')} alt={String(content.alt ?? '')} hotspots={hotspots} selectedHotspotId={selectedHotspotId} placing={placingHotspot} onToggle={() => setPlacingHotspot((value) => !value)} onPlace={(x, y) => { const placed = onPlaceHotspot(x, y); setSelectedHotspotId(placed.id); setPlacingHotspot(false); }} onSelectHotspot={setSelectedHotspotId} /><div className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">{t('studio.hotspots', { default: 'Hotspots' })}</p><p className="text-xs text-muted-foreground">{t('studio.hotspotCoordsHint', { default: 'Use percentages from 0–100 for x and y.' })}</p></div><button type="button" onClick={() => setPlacingHotspot((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"><Plus className="size-3.5" />{placingHotspot ? t('studio.cancelPlacement', { default: 'Cancel placement' }) : t('studio.placeHotspot', { default: 'Place hotspot' })}</button></div>{hotspots.map((hotspot, index) => <div key={hotspot.id} onClick={() => setSelectedHotspotId(hotspot.id)} className={cn('space-y-3 rounded-xl border bg-background p-3 transition', selectedHotspotId === hotspot.id ? 'border-primary ring-2 ring-primary/20' : 'border-border')}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground">{t('studio.hotspotNumber', { number: index + 1, default: 'Hotspot {number}' })}</span><button type="button" onClick={() => onUpdateHotspots(hotspots.filter((item) => item.id !== hotspot.id))} aria-label={t('studio.deleteHotspot', { default: 'Delete hotspot' })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></div><div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass}>{t('studio.xPercent', { default: 'X %' })}</label><input type="number" min={0} max={100} value={hotspot.x} onChange={(event) => onUpdateHotspots(hotspots.map((item) => item.id === hotspot.id ? { ...item, x: Number(event.target.value) } : item))} className={inputClass} /></div><div><label className={labelClass}>{t('studio.yPercent', { default: 'Y %' })}</label><input type="number" min={0} max={100} value={hotspot.y} onChange={(event) => onUpdateHotspots(hotspots.map((item) => item.id === hotspot.id ? { ...item, y: Number(event.target.value) } : item))} className={inputClass} /></div></div><div><label className={labelClass}>{t('studio.label', { default: 'Label' })}</label><input value={hotspot.label} onChange={(event) => onUpdateHotspots(hotspots.map((item) => item.id === hotspot.id ? { ...item, label: event.target.value } : item))} className={inputClass} /></div><div><label className={labelClass}>{t('studio.tooltip', { default: 'Tooltip' })}</label><input value={hotspot.tooltip ?? ''} onChange={(event) => onUpdateHotspots(hotspots.map((item) => item.id === hotspot.id ? { ...item, tooltip: event.target.value } : item))} className={inputClass} /></div><div><label className={labelClass}>{t('studio.detail', { default: 'Detail' })}</label><textarea value={hotspot.detail ?? ''} onChange={(event) => onUpdateHotspots(hotspots.map((item) => item.id === hotspot.id ? { ...item, detail: event.target.value } : item))} className={textareaClass} /></div></div>)}</div></div>}
      {block.type === 'quiz' && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><div><label className={labelClass} htmlFor="quiz-passing-score">{t('studio.passThreshold', { default: 'Pass threshold %' })}</label><input id="quiz-passing-score" type="number" min={0} max={100} step={1} value={Number(content.passingScore ?? 70)} onChange={(event) => onBaseField('passingScore', Math.round(Number(event.target.value)))} className={inputClass} /></div><div><label className={labelClass} htmlFor="quiz-max-attempts">{t('studio.maxAttempts', { default: 'Max attempts' })}</label><input id="quiz-max-attempts" type="number" min={1} value={content.maxAttempts ?? ''} onChange={(event) => onBaseField('maxAttempts', event.target.value ? Number(event.target.value) : null)} className={inputClass} /></div><label className="flex items-end gap-2 pb-2 text-sm text-foreground"><input type="checkbox" checked={Boolean(content.requiredToContinue)} onChange={(event) => onBaseField('requiredToContinue', event.target.checked)} className="size-4 accent-primary" />{t('studio.requiredToContinue', { default: 'Required to continue' })}</label></div><div className="space-y-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-foreground">{t('studio.questions', { default: 'Questions' })}</p><p className="text-xs text-muted-foreground">{t('studio.questionsHint', { default: 'Correct answers stay private and are graded on the server.' })}</p></div><button type="button" onClick={onAddQuestion} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"><Plus className="size-3.5" />{t('studio.addQuestion', { default: 'Add question' })}</button></div>{questions.map((question, questionIndex) => <div key={question.id} className="space-y-3 rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-foreground">{t('studio.questionNumber', { number: questionIndex + 1, default: 'Question {number}' })}</span><button type="button" onClick={() => onRemoveQuestion(question.id)} aria-label={t('studio.deleteQuestion', { default: 'Delete question' })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></div><input value={question.prompt} onChange={(event) => onUpdateQuestion(question.id, { prompt: event.target.value })} placeholder={t('studio.questionPrompt', { default: 'Question prompt' })} className={inputClass} dir={locale === 'ar' ? 'rtl' : 'ltr'} /><div className="grid gap-3 sm:grid-cols-2"><select value={question.type} onChange={(event) => onUpdateQuestion(question.id, { type: event.target.value as QuizQuestion['type'], ...(event.target.value === 'true_false' ? { options: [{ id: makeId('option'), label: 'True' }, { id: makeId('option'), label: 'False' }], correctOptionIds: [] } : {}) }, false)} className={inputClass}><option value="single">{t('studio.singleAnswer', { default: 'Single answer' })}</option><option value="multiple">{t('studio.multipleAnswer', { default: 'Multiple answer' })}</option><option value="true_false">{t('studio.trueFalse', { default: 'True / false' })}</option></select><div className="flex items-center gap-2"><input type="number" min={1} value={question.points ?? 1} onChange={(event) => onUpdateQuestion(question.id, { points: Number(event.target.value) }, false)} className={inputClass} /><span className="shrink-0 text-xs text-muted-foreground">{t('studio.points', { default: 'points' })}</span></div></div><div className="space-y-2"><p className="text-xs font-semibold text-foreground">{t('studio.optionsAndAnswer', { default: 'Options and correct answer' })}</p>{question.options.map((option) => <div key={option.id} className="flex items-center gap-2"><input type={question.type === 'multiple' ? 'checkbox' : 'radio'} checked={(question.correctOptionIds ?? []).includes(option.id)} onChange={(event) => onSetCorrect(question, option.id, event.target.checked)} aria-label={t('studio.markCorrect', { label: option.label, default: 'Mark {label} correct' })} className="size-4 accent-primary" /><input value={option.label} onChange={(event) => onUpdateQuestion(question.id, { options: question.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) })} className={inputClass} /><button type="button" onClick={() => onRemoveOption(question, option.id)} aria-label={t('studio.deleteOption', { default: 'Delete option' })} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="size-4" /></button></div>)}<button type="button" onClick={() => onAddOption(question)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3.5" />{t('studio.addOption', { default: 'Add option' })}</button></div><div><label className={labelClass}>{t('studio.explanationLabel', { default: 'Explanation shown after submission' })}</label><textarea value={question.explanation ?? ''} onChange={(event) => onUpdateQuestion(question.id, { explanation: event.target.value })} className={textareaClass} dir={locale === 'ar' ? 'rtl' : 'ltr'} /></div></div>)}</div></div>}
    </div>
  );
}
