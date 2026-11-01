'use client';
import type { ContentLocale, LessonContentDocument } from '@titan/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Trash2,
  Copy,
  Upload,
  Loader2,
  Paperclip,
  Film,
  Music,
  FileText,
  Image as ImageIcon,
  LayoutList,
  Clapperboard,
  Blocks,
  Files,
} from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { PresenceContext } from 'framer-motion';
import { Modal, ModalTabs, type ModalTab } from '@/components/ui/modal';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  FormSection,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
  TextInput,
} from '@/components/admin/admin-form';
import { SlugField, StatusChip } from '@/components/admin/form-page';
import { DiscardChangesDialog, DrawerFooter, useDirtyClose } from '@/components/admin/drawer-kit';
import { toast } from '@/components/ui/toast';
import type { Attachment, Lesson, LessonVideoMeta, Section } from './types';
import { slugify } from './slugify';
import { LessonBlockEditor } from './LessonBlockEditor';
import * as api from './api';
import { uploadFileToStorage } from '@/lib/upload';
function formatBytes(n: number): string {
  if (!n) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(1)} ${units[i]}`;
}
function FileGlyph({ type }: { type: string }) {
  if (type.startsWith('video')) return <Film className="size-4 text-info" />;
  if (type.startsWith('audio'))
    return <Music className="size-4 text-info" />;
  if (type.startsWith('image'))
    return <ImageIcon className="size-4 text-success" />;
  if (type === 'application/pdf')
    return <FileText className="size-4 text-destructive" />;
  return <Paperclip className="size-4 text-muted-foreground" />;
}
/** Everything the Save button persists — compared against what was loaded to decide "dirty". */
function snapshot(v: {
  title: string;
  slug: string;
  videoUrl: string;
  thumbUrl: string;
  description: string;
  freePreview: boolean;
  attachments: Attachment[];
}): string {
  return JSON.stringify([
    v.title,
    v.slug,
    v.videoUrl,
    v.thumbUrl,
    v.description,
    v.freePreview,
    v.attachments.map((a) => [a.id, a.name, a.url]),
  ]);
}
function isVideoUrl(u: string): boolean {
  if (/^\/uploads\//i.test(u)) return /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(u);
  if (!/^https?:\/\//i.test(u)) return false;
  return /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(u) || u.toLowerCase().includes('/video/');
}
export function LessonDrawer({
  open,
  lesson,
  sections,
  locale,
  onClose,
  onSave,
  onMoveSection,
  onDelete,
  onDuplicate,
  onContentBlocksChange,
}: {
  open: boolean;
  lesson: Lesson | null;
  sections: Section[];
  locale: ContentLocale;
  onClose: () => void;
  onSave: (patch: Partial<Lesson>) => void;
  onMoveSection: (sectionId: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onContentBlocksChange: (document: LessonContentDocument) => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDisplayUrl, setVideoDisplayUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<LessonVideoMeta | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [thumbUrl, setThumbUrl] = useState('');
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbDrag, setThumbDrag] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [attDragOver, setAttDragOver] = useState(false);
  const [description, setDescription] = useState('');
  const [freePreview, setFreePreview] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const attInputRef = useRef<HTMLInputElement>(null);
  const [resolvingVideo, setResolvingVideo] = useState(false);
  const [base, setBase] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [tab, setTab] = useState<'details' | 'media' | 'content' | 'files'>('details');
  const t = useTranslations('courses');
  const tMedia = useTranslations('media');
  const tCommon = useTranslations('common');
  useEffect(() => {
    if (!open || !lesson) return;
    const translation = lesson.translations?.[locale] ?? {};
    setTitle(locale === 'en' ? lesson.title : translation.title ?? '');
    setSlug(lesson.slug);
    // Keep the storage key (not the resolved/expiring playback URL) so saving preserves it.
    setVideoUrl(lesson.videoMeta?.key ?? lesson.videoUrl ?? '');
    setVideoPreview(null);
    // Never use the raw tenants/ storage key as a <video> src — resolve via playback below.
    setVideoDisplayUrl(
      lesson.videoUrl && /^https?:\/\//i.test(lesson.videoUrl) ? lesson.videoUrl : null,
    );
    setVideoMeta(lesson.videoMeta ?? null);
    setVideoProgress(null);
    setThumbUrl(lesson.thumbnailUrl ?? '');
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbPreview(null);
    setThumbDrag(false);
    setDescription(locale === 'en' ? lesson.description ?? '' : translation.description ?? '');
    setFreePreview(lesson.freePreview);
    setAttachments(lesson.attachments ?? []);
    setSectionId(lesson.seriesId);
    setUploading({});
    setAttempted(false);
    setTab('details');
    setBase(
      snapshot({
        title: locale === 'en' ? lesson.title : translation.title ?? '',
        slug: lesson.slug,
        videoUrl: lesson.videoMeta?.key ?? lesson.videoUrl ?? '',
        thumbUrl: lesson.thumbnailUrl ?? '',
        description: locale === 'en' ? lesson.description ?? '' : translation.description ?? '',
        freePreview: lesson.freePreview,
        attachments: lesson.attachments ?? [],
      }),
    );
  }, [open, lesson?.id, locale, resetKey]);

  const dirty =
    base !== null &&
    base !== snapshot({ title, slug, videoUrl, thumbUrl, description, freePreview, attachments });
  const guard = useDirtyClose(dirty, onClose);
  const [deleteArmed, setDeleteArmed] = useState(false);

  // Resolve S3 storage keys (tenants/...) to a playable signed URL for the admin preview.
  // Admins always pass the paywall, so this also verifies the upload actually persisted.
  useEffect(() => {
    if (!open || !lesson) return;
    const key = lesson.videoMeta?.key ?? lesson.videoUrl ?? '';
    if (!key.startsWith('tenants/')) return;
    let cancelled = false;
    setResolvingVideo(true);
    fetch(`/api/proxy/courses/lessons/${encodeURIComponent(lesson.slug)}/playback`, {
      credentials: 'include',
      headers: { 'x-locale': locale, 'x-next-locale': locale, 'accept-language': `${locale},en;q=0.8` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Playback failed (${r.status})`);
        return r.json();
      })
      .then((data: { url?: string }) => {
        if (!cancelled && data?.url) setVideoDisplayUrl(data.url);
      })
      .catch(() => {
        // Keep null → drawer shows "uploaded but not playable" hint below.
      })
      .finally(() => {
        if (!cancelled) setResolvingVideo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, lesson?.id, locale]);
  // Same root element in both branches so AnimatePresence survives the close and plays the exit.
  if (!open || !lesson) return <AnimatePresence />;
  const uploadingCount = Object.values(uploading).filter(Boolean).length;
  const patchAttachment = (id: string, patch: Partial<Attachment>) =>
    setAttachments((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeAttachment = (id: string) => setAttachments((a) => a.filter((x) => x.id !== id));
  const handleVideoFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ type: 'err', title: tMedia('notAVideo', { default: 'Not a video' }), description: tMedia('chooseVideoFile', { default: 'Please choose a video file.' }) });
      return;
    } // Immediate local preview regardless of storage backend.
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    const localPreview = URL.createObjectURL(file);
    setVideoPreview(localPreview);
    setUploading((u) => ({ ...u, video: true }));
    setVideoProgress(0);
    try {
      let key: string;
      let meta: LessonVideoMeta;
      try {
        // Preferred path: browser uploads directly to storage via a presigned PUT URL.
        const { uploadUrl, key: k } = await api.getLessonUploadUrl(lesson.id, {
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }); // Use XHR so we can report real upload progress.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setVideoProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(tMedia('uploadFailedWithStatus', { status: xhr.status, default: 'Upload failed ({status})' })));
          };
          xhr.onerror = () => reject(new Error(tMedia('networkErrorDuringUpload', { default: 'Network error during upload' })));
          xhr.send(file);
        });
        setVideoProgress(100);
        key = k;
        meta = { key, size: file.size, contentType: file.type, filename: file.name };
      } catch (presignErr) {
        /**
         * There is no base64 fallback, and that is the fix.
         *
         * Any presign failure used to be swallowed and quietly routed into two fallback
         * paths that POST the video as base64 JSON — bounded by the 2 MB API body limit. A
         * storage problem therefore surfaced to the author as "File is too large", which
         * described neither the cause nor the file they had chosen. The real error now
         * reaches them.
         */
        setVideoProgress(null);
        throw presignErr;
      }
      setVideoUrl(key);
      setVideoMeta(meta);
      setVideoDisplayUrl(null);
      toast({ type: 'ok', title: tMedia('videoUploaded', { default: 'Video uploaded' }) });
    } catch (e: any) {
      URL.revokeObjectURL(localPreview);
      setVideoPreview(null);
      toast({ type: 'err', title: tMedia('uploadFailed', { default: 'Upload failed' }), description: e?.message });
    } finally {
      setUploading((u) => ({ ...u, video: false }));
      setTimeout(() => setVideoProgress(null), 1200);
    }
  };
  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setVideoDisplayUrl(null);
    setVideoUrl('');
    setVideoMeta(null);
    setVideoProgress(null);
  };
  const handleThumbFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: tMedia('notAnImage', { default: 'Not an image' }), description: tMedia('chooseImageFile', { default: 'Please choose an image file.' }) });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: 'err', title: tMedia('fileTooLarge', { default: 'File too large' }), description: tMedia('thumbnailSizeLimit', { default: 'Max 5 MB per thumbnail.' }) });
      return;
    }
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    const localPreview = URL.createObjectURL(file);
    setThumbPreview(localPreview);
    setUploading((u) => ({ ...u, thumb: true }));
    try {
      const res = await uploadFileToStorage(file, 'covers');
      setThumbUrl(res.url);
      toast({ type: 'ok', title: tMedia('thumbnailUploaded', { default: 'Thumbnail uploaded' }) });
    } catch (e: any) {
      URL.revokeObjectURL(localPreview);
      setThumbPreview(null);
      toast({ type: 'err', title: tMedia('thumbnailUploadFailed', { default: 'Thumbnail upload failed' }), description: e?.message });
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next.thumb;
        return next;
      });
    }
  };
  const removeThumb = () => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbPreview(null);
    setThumbUrl('');
  };
  const handleAttachmentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const temp: Attachment = {
        id,
        name: file.name,
        type: file.type || 'file',
        url: '',
        size: file.size,
      };
      setAttachments((a) => [...a, temp]);
      setUploading((u) => ({ ...u, [id]: true }));
      try {
        const res = await uploadFileToStorage(file, 'attachments');
        setAttachments((a) =>
          a.map((x) =>
            x.id === id
              ? { ...x, url: res.url, name: res.name, type: res.type, size: res.size }
              : x,
          ),
        );
      } catch (e: any) {
        setAttachments((a) => a.filter((x) => x.id !== id));
        toast({ type: 'err', title: tMedia('uploadFailed', { default: 'Upload failed' }), description: e?.message });
      } finally {
        setUploading((u) => {
          const next = { ...u };
          delete next[id];
          return next;
        });
      }
    }
  };
  const save = () => {
    if (locale === 'en' && !title.trim()) {
      setAttempted(true);
      setTab('details');
      return;
    }
    if (uploadingCount > 0) {
      toast({ type: 'err', title: t('studio.stillUploading', { default: 'Still uploading' }), description: t('studio.stillUploadingHint', { default: 'Wait for uploads to finish' }) });
      return;
    }
    const clean = attachments.filter((a) => a.url && a.url.trim());
    const isStorageKey = !!videoUrl && videoUrl.startsWith('tenants/');
    const commonPatch = {
      slug: slug.trim() || (locale === 'en' ? slugify(title) : lesson.slug),
      videoUrl: videoUrl.trim() || null,
      thumbnailUrl: thumbUrl.trim() || null,
      videoMeta: isStorageKey ? (videoMeta ?? null) : null,
      freePreview,
      attachments: clean.length ? clean : null,
    };
    if (locale === 'en') {
      onSave({ ...commonPatch, title: title.trim(), description: description.trim() || null });
    } else {
      onSave({
        ...commonPatch,
        translations: {
          ...(lesson.translations ?? {}),
          [locale]: {
            ...(lesson.translations?.[locale] ?? {}),
            title: title.trim() || undefined,
            description: description.trim() || null,
          },
        },
      });
    }
    onClose();
  };
  const displaySrc =
    videoPreview || videoDisplayUrl || (videoUrl && isVideoUrl(videoUrl) ? videoUrl : null);
  const titleError =
    attempted && locale === 'en' && !title.trim()
      ? t('studio.titleRequired', { default: 'Lesson title is required' })
      : undefined;
  const tabs: ModalTab[] = [
    { key: 'details', label: t('studio.drawerTabDetails', { default: 'Details' }), icon: LayoutList },
    { key: 'media', label: t('studio.drawerTabMedia', { default: 'Media' }), icon: Clapperboard },
    { key: 'content', label: t('studio.drawerTabContent', { default: 'Content' }), icon: Blocks },
    { key: 'files', label: t('studio.attachments', { default: 'Attachments' }), icon: Files },
  ];
  const dropZone = (active: boolean) =>
    cn(
      'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-7 text-center transition-colors',
      active
        ? 'border-primary/60 bg-primary/5'
        : 'border-border bg-muted/20 hover:border-border-strong hover:bg-muted/40',
    );
  const panel = (key: typeof tab) => cn('space-y-5', tab !== key && 'hidden');
  const pageTitle = lesson.title || title || t('studio.newLesson', { default: 'New lesson' });
  const statusTone = lesson.isArchived ? 'archived' : lesson.isPublished ? 'live' : 'draft';
  const statusLabel = lesson.isArchived
    ? t('studio.statusArchived', { default: 'Archived' })
    : lesson.isPublished
      ? t('studio.statusPublished', { default: 'Published' })
      : t('studio.statusDraft', { default: 'Draft' });
  return (
    <>
      <AnimatePresence>
        <Modal
          key="lesson-drawer"
          width="max-w-4xl"
          onClose={guard.requestClose}
          title={pageTitle}
          header={
            <>
            <div className="flex items-center gap-3 border-b border-border/70 bg-card px-5 py-4 sm:gap-4 sm:px-7 sm:py-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-medium text-primary ring-1 ring-inset ring-primary/15 sm:size-12">
                {pageTitle.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display text-xl font-medium leading-tight tracking-[-0.015em] text-foreground sm:text-2xl">
                    {pageTitle}
                  </p>
                  <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
                </div>
                <p dir="ltr" className="truncate text-start font-mono text-xs text-muted-foreground">
                  /{slug || 'slug'}
                </p>
              </div>
              <button
                type="button"
                aria-label={tCommon('close')}
                onClick={guard.requestClose}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-90"
              >
                <X className="size-[18px]" />
              </button>
            </div>
            {/* Shared-layout tab pill: kept outside the exit presence so closing never hangs. */}
            <PresenceContext.Provider value={null}>
              <ModalTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />
            </PresenceContext.Provider>
            </>
          }
        >
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <div className={panel('details')}>
              <FormSection as="h3" title={t('studio.drawerTabDetails', { default: 'Details' })}>
                <div className="space-y-4">
                  <TextField
                    label={`${t('studio.live.titleLabel', { default: 'Title' })}${
                      locale === 'en' ? '' : ` ${t('studio.arabicTranslation', { default: '(Arabic translation)' })}`
                    }`}
                    required={locale === 'en'}
                    value={title}
                    error={titleError}
                    onChange={(e) => setTitle(e.target.value)}
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  />
                  <SlugField
                    label={t('studio.slug', { default: 'Slug' })}
                    value={slug}
                    onChange={setSlug}
                    prefix="/"
                    mode="edit"
                  />
                  <div className="space-y-2">
                    <SelectField
                      label={t('studio.section', { default: 'Section' })}
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </SelectField>
                    {sectionId !== lesson.seriesId && (
                      <button
                        type="button"
                        onClick={() => onMoveSection(sectionId)}
                        className="rounded-lg bg-primary px-3 py-1.5 font-sans text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
                      >
                        {t('studio.moveToSection', {
                          title: sections.find((s) => s.id === sectionId)?.title ?? '',
                          default: 'Move to “{title}”',
                        })}
                      </button>
                    )}
                  </div>
                  <TextAreaField
                    label={t('studio.description', { default: 'Description' })}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  />
                  <SwitchField
                    label={t('studio.freePreview', { default: 'Free preview' })}
                    description={t('studio.freePreviewHint', {
                      default: 'Let unenrolled learners watch this lesson',
                    })}
                    checked={freePreview}
                    onCheckedChange={setFreePreview}
                  />
                </div>
              </FormSection>
            </div>

            <div className={panel('media')}>
              <FormSection as="h3" title={t('studio.lessonVideo', { default: 'Lesson video' })}>
                <div className="space-y-2">
                  {resolvingVideo && !displaySrc ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 font-sans text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />{' '}
                      {t('studio.resolvingVideo', { default: 'Resolving stored video for preview…' })}
                    </div>
                  ) : null}
                  {videoUrl.startsWith('tenants/') && !resolvingVideo && !videoDisplayUrl && !videoPreview ? (
                    <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 font-sans text-xs text-warning">
                      {t('studio.videoKeyUnresolved', {
                        key: videoUrl.slice(0, 60),
                        default:
                          'Video key saved ({key}…) but no playable URL resolved — the file may be missing in storage. Re-upload below.',
                      })}
                    </div>
                  ) : null}
                  {displaySrc ? (
                    <div className="space-y-2">
                      <video
                        src={displaySrc}
                        controls
                        className="h-48 w-full rounded-xl border border-border/70 bg-muted object-contain"
                      />
                      <div className="flex items-center justify-between">
                        <p className="font-sans text-xs text-muted-foreground">
                          {videoMeta
                            ? `${videoMeta.filename} · ${formatBytes(videoMeta.size)}`
                            : tMedia('videoUploaded', { default: 'Video uploaded' })}
                        </p>
                        <button
                          type="button"
                          onClick={removeVideo}
                          className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10"
                        >
                          {tMedia('remove', { default: 'Remove' })}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      void handleVideoFile(e.dataTransfer.files?.[0]);
                    }}
                    className={dropZone(dragOver)}
                  >
                    <Upload className="size-5 text-muted-foreground/70" />
                    <p className="font-sans text-sm text-muted-foreground">
                      {dragOver
                        ? tMedia('dropToUpload', { default: 'Drop to upload' })
                        : tMedia('dropVideoBrowse', { default: 'Drag & drop a video, or click to browse' })}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground/60">
                      {tMedia('videoFormatsHint', { default: 'MP4, WebM, MOV · up to 500MB' })}
                    </p>
                  </div>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleVideoFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  {uploading.video && videoProgress !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <m.div
                          className="h-full rounded-full bg-primary"
                          initial={false}
                          animate={{ width: `${videoProgress}%` }}
                          transition={spring.smooth}
                        />
                      </div>
                      <span className="font-sans text-xs tabular-nums text-muted-foreground">
                        {videoProgress}%
                      </span>
                    </div>
                  ) : uploading.video ? (
                    <div className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />{' '}
                      {tMedia('uploading', { default: 'Uploading…' })}
                    </div>
                  ) : null}
                </div>
              </FormSection>

              <FormSection
                as="h3"
                title={t('studio.lessonThumbnail', { default: 'Lesson thumbnail' })}
                badge={t('studio.optional', { default: 'Optional' })}
              >
                <div className="space-y-2">
                  {(thumbPreview || thumbUrl) && (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbPreview || thumbUrl}
                        alt=""
                        className="h-36 w-full rounded-xl border border-border/70 bg-muted object-cover"
                      />
                      <div className="flex items-center justify-between">
                        <p className="font-sans text-xs text-muted-foreground">
                          {thumbPreview
                            ? t('studio.newThumbnail', { default: 'New thumbnail — saves with lesson' })
                            : t('studio.thumbnailSaved', { default: 'Thumbnail saved' })}
                        </p>
                        <button
                          type="button"
                          onClick={removeThumb}
                          className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10"
                        >
                          {tMedia('remove', { default: 'Remove' })}
                        </button>
                      </div>
                    </div>
                  )}
                  <div
                    onClick={() => thumbInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setThumbDrag(true);
                    }}
                    onDragLeave={() => setThumbDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setThumbDrag(false);
                      void handleThumbFile(e.dataTransfer.files?.[0]);
                    }}
                    className={dropZone(thumbDrag)}
                  >
                    <ImageIcon className="size-5 text-muted-foreground/70" />
                    <p className="font-sans text-sm text-muted-foreground">
                      {thumbDrag
                        ? tMedia('dropToUpload', { default: 'Drop to upload' })
                        : tMedia('dropThumbBrowse', { default: 'Drag & drop a thumbnail, or click to browse' })}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground/60">
                      {tMedia('thumbFormatsHint', { default: 'JPG, PNG, WebP · 16:9 recommended · up to 5MB' })}
                    </p>
                  </div>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleThumbFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  {uploading.thumb ? (
                    <div className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />{' '}
                      {tMedia('uploadingThumbnail', { default: 'Uploading thumbnail…' })}
                    </div>
                  ) : null}
                </div>
              </FormSection>
            </div>

            <div className={panel('content')}>
              <LessonBlockEditor
                key={lesson.id}
                lessonId={lesson.id}
                initialDocument={lesson.contentBlocks}
                locale={locale}
                videoUrl={displaySrc}
                onDocumentChange={onContentBlocksChange}
              />
            </div>

            <div className={panel('files')}>
              <FormSection
                as="h3"
                title={t('studio.attachments', { default: 'Attachments' })}
                badge={t('studio.optional', { default: 'Optional' })}
              >
                <div className="space-y-3">
                  <div
                    onClick={() => attInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAttDragOver(true);
                    }}
                    onDragLeave={() => setAttDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAttDragOver(false);
                      void handleAttachmentFiles(e.dataTransfer.files);
                    }}
                    className={dropZone(attDragOver)}
                  >
                    <Upload className="size-5 text-muted-foreground/70" />
                    <p className="font-sans text-sm text-muted-foreground">
                      {attDragOver
                        ? tMedia('dropToAttach', { default: 'Drop to attach' })
                        : tMedia('dropFilesBrowse', { default: 'Drag & drop files, or click to browse' })}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground/60">
                      {tMedia('attachmentFormatsHint', { default: 'PDF, slides, images, video · multiple allowed' })}
                    </p>
                  </div>
                  <input
                    ref={attInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleAttachmentFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {attachments.map((a) => {
                        const busy = uploading[a.id];
                        return (
                          <m.div
                            key={a.id}
                            layout="position"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                            transition={spring.smooth}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card p-2 shadow-xs"
                          >
                            {busy ? (
                              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                            ) : (
                              <FileGlyph type={a.type} />
                            )}
                            <TextInput
                              value={a.name}
                              disabled={busy}
                              aria-label={tMedia('label', { default: 'Label' })}
                              onChange={(e) => patchAttachment(a.id, { name: e.target.value })}
                              placeholder={tMedia('label', { default: 'Label' })}
                              className="h-8 w-40 px-2 py-1"
                            />
                            {busy ? (
                              <span className="font-sans text-xs text-muted-foreground">
                                {tMedia('uploading', { default: 'Uploading…' })}
                              </span>
                            ) : a.url ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                dir="ltr"
                                className="min-w-0 flex-1 truncate font-sans text-xs text-primary underline-offset-2 hover:underline"
                              >
                                {a.url}
                              </a>
                            ) : (
                              <span className="flex-1" />
                            )}
                            {!busy && a.size ? (
                              <span className="whitespace-nowrap font-sans text-xs text-muted-foreground">
                                {formatBytes(a.size)}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeAttachment(a.id)}
                              aria-label={tMedia('removeAttachment', { default: 'Remove attachment' })}
                              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          </m.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>
          <DrawerFooter
            dirty={dirty}
            canSave={uploadingCount === 0}
            onSave={save}
            onDiscard={() => setResetKey((k) => k + 1)}
            onClose={guard.requestClose}
            saveLabel={
              uploadingCount > 0
                ? tMedia('uploading', { default: 'Uploading…' })
                : t('studio.saveLesson', { default: 'Save lesson' })
            }
            extra={
              <>
                <button
                  type="button"
                  onClick={onDuplicate}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Copy className="size-4" />
                  <span className="hidden sm:inline">{t('studio.duplicate', { default: 'Duplicate' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!deleteArmed) {
                      setDeleteArmed(true);
                      return;
                    }
                    onDelete();
                  }}
                  onBlur={() => setDeleteArmed(false)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-sans text-sm font-medium transition',
                    deleteArmed
                      ? 'bg-destructive text-destructive-foreground'
                      : 'text-destructive hover:bg-destructive/10',
                  )}
                >
                  <Trash2 className="size-4" />
                  <span className={deleteArmed ? '' : 'hidden sm:inline'}>
                    {deleteArmed
                      ? t('studio.confirmDelete', { default: 'Confirm delete' })
                      : tCommon('delete', { default: 'Delete' })}
                  </span>
                </button>
              </>
            }
          />
        </Modal>
      </AnimatePresence>
      <DiscardChangesDialog guard={guard} />
    </>
  );
}
