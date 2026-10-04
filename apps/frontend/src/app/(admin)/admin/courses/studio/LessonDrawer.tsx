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
} from 'lucide-react';
import { Modal, ModalHeader } from '@/components/ui/modal';
import { INPUT, LABEL } from './glass';
import { toast } from '@/components/ui/toast';
import type { Attachment, Lesson, LessonVideoMeta, Section } from './types';
import { slugify } from './slugify';
import { LessonBlockEditor } from './LessonBlockEditor';
import * as api from './api';
function readFileAsDataUrl(file: File, errorMessage = 'Could not read file'): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(errorMessage));
    r.readAsDataURL(file);
  });
}
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
    return <ImageIcon className="size-4 text-success dark:text-success" />;
  if (type === 'application/pdf')
    return <FileText className="size-4 text-destructive" />;
  return <Paperclip className="size-4 text-muted-foreground" />;
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
  const [slugTouched, setSlugTouched] = useState(false);
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
  const t = useTranslations('courses');
  const tMedia = useTranslations('media');
  const tCommon = useTranslations('common');
  useEffect(() => {
    if (!open || !lesson) return;
    const translation = lesson.translations?.[locale] ?? {};
    setTitle(locale === 'en' ? lesson.title : translation.title ?? '');
    setSlug(lesson.slug);
    setSlugTouched(true);
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
  }, [open, lesson?.id, locale]);

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
  if (!open || !lesson) return null;
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
      } catch (_presignErr) {
        // Intentionally swallowed: the presign failure is not surfaced to the user,
        // it just selects the fallback path below. Fallback 1: server stores to S3;
        // Fallback 2: local disk (works when MinIO is down).
        setVideoProgress(null);
        const dataUrl = await readFileAsDataUrl(file, tMedia('couldNotReadFile', { default: 'Could not read file' }));
        try {
          const res = await api.uploadLessonVideoServer(lesson.id, {
            file: dataUrl,
            filename: file.name,
          });
          key = res.key;
          meta = res.meta;
        } catch {
          const res2 = await api.uploadFile(dataUrl, 'lessons', file.name);
          key = res2.url;
          meta = { key: res2.url, size: res2.size, contentType: res2.type, filename: res2.name };
        }
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
      const dataUrl = await readFileAsDataUrl(file, tMedia('couldNotReadFile', { default: 'Could not read file' }));
      const res = await api.uploadFile(dataUrl, 'covers', file.name);
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
        const dataUrl = await readFileAsDataUrl(file, tMedia('couldNotReadFile', { default: 'Could not read file' }));
        const res = await api.uploadFile(dataUrl, 'attachments', file.name);
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
      toast({ type: 'err', title: t('studio.titleRequired', { default: 'Lesson title is required' }) });
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
  return (
    <Modal
      width="max-w-5xl"
      onClose={onClose}
      title={title || t('studio.newLesson', { default: 'New lesson' })}
      header={
        <ModalHeader
          loading={false}
          initials={(title || 'L').charAt(0).toUpperCase()}
          gradient="bg-info/10 text-info"
          title={title || t('studio.newLesson', { default: 'New lesson' })}
          subtitle={'/' + (slug || 'slug')}
          onClose={onClose}
        />
      }
    >
      {' '}
      <div className="space-y-5 px-6 py-5">
        {' '}
        <div className="space-y-1.5">
          {' '}
           <label className={LABEL}>{t('studio.title', { default: 'Title' })} {locale === 'en' ? '*' : t('studio.arabicTranslation', { default: '(Arabic translation)' })}</label>{' '}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={INPUT}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>{t('studio.slug', { default: 'Slug' })}</label>{' '}
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={INPUT + ' font-mono text-sm'}
          />{' '}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>{t('studio.section', { default: 'Section' })}</label>{' '}
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={INPUT}
          >
            {' '}
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {' '}
                {s.title}{' '}
              </option>
            ))}{' '}
          </select>{' '}
          {sectionId !== lesson.seriesId && (
            <button
              type="button"
              onClick={() => onMoveSection(sectionId)}
              className="mt-1 rounded-lg bg-accent px-3 py-1.5 font-sans text-sm font-medium text-accent-foreground transition hover:bg-primary"
            >
              {' '}
              {t('studio.moveToSection', { title: sections.find((s) => s.id === sectionId)?.title ?? '', default: 'Move to “{title}”' })}{' '}
            </button>
          )}{' '}
        </div>{' '}
        <div className="space-y-2">
          {' '}
          <label className={LABEL}>{t('studio.lessonVideo', { default: 'Lesson video' })}</label>{' '}
          {resolvingVideo && !displaySrc ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 font-sans text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t('studio.resolvingVideo', { default: 'Resolving stored video for preview…' })}
            </div>
          ) : null}
          {videoUrl.startsWith('tenants/') &&
          !resolvingVideo &&
          !videoDisplayUrl &&
          !videoPreview ? (
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 font-sans text-xs text-warning ">
              {t('studio.videoKeyUnresolved', { key: videoUrl.slice(0, 60), default: 'Video key saved ({key}…) but no playable URL resolved — the file may be missing in storage. Re-upload below.' })}
            </div>
          ) : null}
          {displaySrc ? (
            <div className="space-y-2">
              {' '}
              <video
                src={displaySrc}
                controls
                className="h-40 w-full rounded-xl bg-muted object-contain"
              />{' '}
              <div className="flex items-center justify-between">
                {' '}
                <p className="font-sans text-xs text-muted-foreground">
                  {' '}
                  {videoMeta
                    ? `${videoMeta.filename} · ${formatBytes(videoMeta.size)}`
                    : tMedia('videoUploaded', { default: 'Video uploaded' })}{' '}
                </p>{' '}
                <button
                  type="button"
                  onClick={removeVideo}
                  className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10 dark:text-destructive"
                >
                  {' '}
                  {tMedia('remove', { default: 'Remove' })}{' '}
                </button>{' '}
              </div>{' '}
            </div>
          ) : null}{' '}
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
            className={
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition ' +
              (dragOver
                ? 'border-accent bg-accent/10'
                : 'border-border bg-card hover:border-accent/60')
            }
          >
            {' '}
            <Upload className="size-5 text-muted-foreground/70" />{' '}
            <p className="font-sans text-sm text-muted-foreground">
              {' '}
              {dragOver ? tMedia('dropToUpload', { default: 'Drop to upload' }) : tMedia('dropVideoBrowse', { default: 'Drag & drop a video, or click to browse' })}{' '}
            </p>{' '}
            <p className="font-sans text-xs text-muted-foreground/60">
              {tMedia('videoFormatsHint', { default: 'MP4, WebM, MOV · up to 500MB' })}
            </p>{' '}
          </div>{' '}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              void handleVideoFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />{' '}
          {uploading.video && videoProgress !== null ? (
            <div className="flex items-center gap-2">
              {' '}
              <div className="h-2 flex-1 overflow-hidden rounded-md bg-card dark:bg-card">
                {' '}
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${videoProgress}%` }}
                />{' '}
              </div>{' '}
              <span className="font-sans text-xs tabular-nums text-muted-foreground">
                {videoProgress}%
              </span>{' '}
            </div>
          ) : uploading.video ? (
            <div className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
              {' '}
              <Loader2 className="size-3.5 animate-spin" /> {tMedia('uploading', { default: 'Uploading…' })}{' '}
            </div>
          ) : null}{' '}
        </div>{' '}
        <div className="space-y-2">
          <label className={LABEL}>{t('studio.lessonThumbnail', { default: 'Lesson thumbnail' })}</label>
          {(thumbPreview || thumbUrl) && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbPreview || thumbUrl}
                alt=""
                className="h-32 w-full rounded-xl border border-border bg-muted object-cover"
              />
              <div className="flex items-center justify-between">
                <p className="font-sans text-xs text-muted-foreground">
                  {thumbPreview ? t('studio.newThumbnail', { default: 'New thumbnail — saves with lesson' }) : t('studio.thumbnailSaved', { default: 'Thumbnail saved' })}
                </p>
                <button
                  type="button"
                  onClick={removeThumb}
                  className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10 dark:text-destructive"
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
            className={
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition ' +
              (thumbDrag
                ? 'border-accent bg-accent/10'
                : 'border-border bg-card hover:border-accent/60')
            }
          >
            <ImageIcon className="size-5 text-muted-foreground/70" />
            <p className="font-sans text-sm text-muted-foreground">
              {thumbDrag ? tMedia('dropToUpload', { default: 'Drop to upload' }) : tMedia('dropThumbBrowse', { default: 'Drag & drop a thumbnail, or click to browse' })}
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
              <Loader2 className="size-3.5 animate-spin" /> {tMedia('uploadingThumbnail', { default: 'Uploading thumbnail…' })}
            </div>
          ) : null}
        </div>{' '}
        <div className="space-y-1.5">
          {' '}
          <label className={LABEL}>{t('studio.description', { default: 'Description' })}</label>{' '}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={INPUT + ' resize-y'}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          />{' '}
        </div>{' '}
        <div className="border-t border-border pt-5">
          <LessonBlockEditor
            key={lesson.id}
            lessonId={lesson.id}
            initialDocument={lesson.contentBlocks}
            locale={locale}
            videoUrl={displaySrc}
            onDocumentChange={onContentBlocksChange}
          />
        </div>
        <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          {' '}
          <span>
            {' '}
            <span className="font-sans text-sm font-medium text-foreground">{t('studio.freePreview', { default: 'Free preview' })}</span>{' '}
            <span className="block font-sans text-xs text-muted-foreground">
              {t('studio.freePreviewHint', { default: 'Let unenrolled learners watch this lesson' })}
            </span>{' '}
          </span>{' '}
          <button
            type="button"
            onClick={() => setFreePreview((v) => !v)}
            className={
              'relative h-6 w-11 rounded-full transition ' +
              (freePreview ? 'bg-accent' : 'bg-muted')
            }
            aria-pressed={freePreview}
          >
            {' '}
            <span
              className={
                'absolute top-0.5 size-5 rounded-md bg-card shadow transition-all ' +
                (freePreview ? 'start-[22px]' : 'start-0.5')
              }
            />{' '}
          </button>{' '}
        </label>{' '}
        <div className="space-y-2">
          {' '}
          <label className={LABEL}>{t('studio.attachments', { default: 'Attachments' })}</label>{' '}
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
            className={
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition ' +
              (attDragOver
                ? 'border-accent bg-accent/10'
                : 'border-border bg-card hover:border-accent/60')
            }
          >
            {' '}
            <Upload className="size-5 text-muted-foreground/70" />{' '}
            <p className="font-sans text-sm text-muted-foreground">
              {' '}
              {attDragOver ? tMedia('dropToAttach', { default: 'Drop to attach' }) : tMedia('dropFilesBrowse', { default: 'Drag & drop files, or click to browse' })}{' '}
            </p>{' '}
            <p className="font-sans text-xs text-muted-foreground/60">
              {tMedia('attachmentFormatsHint', { default: 'PDF, slides, images, video · multiple allowed' })}
            </p>{' '}
          </div>{' '}
          <input
            ref={attInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleAttachmentFiles(e.target.files);
              e.target.value = '';
            }}
          />{' '}
          <div className="space-y-2">
            {' '}
            {attachments.map((a) => {
              const busy = uploading[a.id];
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-2"
                >
                  {' '}
                  {busy ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <FileGlyph type={a.type} />
                  )}{' '}
                  <input
                    value={a.name}
                    disabled={busy}
                    onChange={(e) => patchAttachment(a.id, { name: e.target.value })}
                    placeholder={tMedia('label', { default: 'Label' })}
                    className="w-36 rounded-md border border-border bg-transparent px-2 py-1 font-sans text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                  />{' '}
                  {busy ? (
                    <span className="font-sans text-xs text-muted-foreground">{tMedia('uploading', { default: 'Uploading…' })}</span>
                  ) : a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate font-sans text-xs text-info hover:underline"
                    >
                      {' '}
                      {a.url}{' '}
                    </a>
                  ) : (
                    <span className="flex-1" />
                  )}{' '}
                  {!busy && a.size ? (
                    <span className="whitespace-nowrap font-sans text-xs text-muted-foreground">
                      {formatBytes(a.size)}
                    </span>
                  ) : null}{' '}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={tMedia('removeAttachment', { default: 'Remove attachment' })}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    {' '}
                    <X className="size-4" />{' '}
                  </button>{' '}
                </div>
              );
            })}{' '}
          </div>{' '}
        </div>{' '}
        <div className="flex items-center justify-between border-t border-border pt-4">
          {' '}
          <div className="flex items-center gap-2">
            {' '}
            <button
              type="button"
              onClick={onDuplicate}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 font-sans text-sm text-muted-foreground transition hover:text-foreground"
            >
              {' '}
              <Copy className="size-4" /> {t('studio.duplicate', { default: 'Duplicate' })}{' '}
            </button>{' '}
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-300/60 px-3 py-2 font-sans text-sm text-destructive transition hover:bg-destructive/10 dark:border-red-900/40 dark:text-destructive"
            >
              {' '}
              <Trash2 className="size-4" /> {tCommon('delete', { default: 'Delete' })}{' '}
            </button>{' '}
          </div>{' '}
          <button
            type="button"
            onClick={save}
            disabled={uploadingCount > 0}
            className="rounded-lg bg-accent px-4 py-2 font-sans text-sm font-medium text-accent-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {' '}
            {uploadingCount > 0 ? tMedia('uploading', { default: 'Uploading…' }) : t('studio.saveLesson', { default: 'Save lesson' })}{' '}
          </button>{' '}
        </div>{' '}
      </div>{' '}
    </Modal>
  );
}
