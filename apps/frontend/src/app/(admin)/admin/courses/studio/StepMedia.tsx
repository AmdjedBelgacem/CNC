'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X, Paperclip, Upload, Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { FormSection } from '@/components/admin/admin-form';
import type { CourseStudioData } from './types';
import * as api from './api';
import { toast } from '@/components/ui/toast';
interface ResourceRow {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}
function readFileAsDataUrl(file: File, errorMessage = 'Could not read file'): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(errorMessage));
    r.readAsDataURL(file);
  });
}
function readResources(meta: Record<string, unknown> | null): ResourceRow[] {
  const r = meta?.resources;
  if (Array.isArray(r)) return r as ResourceRow[];
  return [];
}
export function StepMedia({
  course,
  update,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
}) {
  const resources = readResources(course.metadata);
  const t = useTranslations('media');
  const setResources = (rows: ResourceRow[]) => {
    update({ metadata: { ...(course.metadata ?? {}), resources: rows } });
  };
  const addResource = () =>
    setResources([
      ...resources,
      { id: crypto.randomUUID(), name: '', type: 'file', url: '', size: 0 },
    ]);
  const patchResource = (id: string, patch: Partial<ResourceRow>) =>
    setResources(resources.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeResource = (id: string) => setResources(resources.filter((r) => r.id !== id));
  const [resourceUploading, setResourceUploading] = useState<string | null>(null);
  const handleResourceFile = async (id: string, file?: File | null) => {
    if (!file) return;
    setResourceUploading(id);
    try {
      const dataUrl = await readFileAsDataUrl(file, t('couldNotReadFile', { default: 'Could not read file' }));
      const result = await api.uploadFile(dataUrl, 'resources', file.name);
      patchResource(id, { name: result.name, type: result.type, url: result.url, size: result.size });
      toast({ type: 'ok', title: t('resourceUploaded', { default: 'Resource uploaded' }) });
    } catch (error) {
      toast({ type: 'err', title: t('resourceUploadFailed', { default: 'Resource upload failed' }), description: error instanceof Error ? error.message : undefined });
    } finally {
      setResourceUploading(null);
    }
  };
  const [thumbUploading, setThumbUploading] = useState(false);
  const [trailerUploading, setTrailerUploading] = useState(false);
  const [thumbDrag, setThumbDrag] = useState(false);
  const [trailerDrag, setTrailerDrag] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [trailerPreview, setTrailerPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
  }, [thumbPreview]);
  useEffect(() => () => {
    if (trailerPreview) URL.revokeObjectURL(trailerPreview);
  }, [trailerPreview]);
  const handleThumbFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: t('notAnImage', { default: 'Not an image' }), description: t('chooseImageFile', { default: 'Please choose an image file.' }) });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ type: 'err', title: t('imageTooLarge', { default: 'Image is too large' }), description: t('imageSizeLimit', { default: 'Choose an image under 10 MB.' }) });
      return;
    }
    setThumbPreview(URL.createObjectURL(file));
    setThumbUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, t('couldNotReadFile', { default: 'Could not read file' }));
      const res = await api.uploadFile(dataUrl, 'covers', file.name);
      update({ thumbnailUrl: res.url });
      toast({ type: 'ok', title: t('thumbnailUploaded', { default: 'Thumbnail uploaded' }) });
    } catch (e: any) {
      setThumbPreview(null);
      toast({ type: 'err', title: t('uploadFailed', { default: 'Upload failed' }), description: e?.message });
    } finally {
      setThumbUploading(false);
    }
  };
  const handleTrailerFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ type: 'err', title: t('notAVideo', { default: 'Not a video' }), description: t('chooseVideoFile', { default: 'Please choose a video file.' }) });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({ type: 'err', title: t('videoTooLarge', { default: 'Video is too large' }), description: t('videoSizeLimit', { default: 'Choose a video under 500 MB.' }) });
      return;
    }
    setTrailerPreview(URL.createObjectURL(file));
    setTrailerUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file, t('couldNotReadFile', { default: 'Could not read file' }));
      const res = await api.uploadFile(dataUrl, 'trailers', file.name);
      update({ trailerUrl: res.url });
      toast({ type: 'ok', title: t('trailerUploaded', { default: 'Trailer uploaded' }) });
    } catch (e: any) {
      setTrailerPreview(null);
      toast({ type: 'err', title: t('uploadFailed', { default: 'Upload failed' }), description: e?.message });
    } finally {
      setTrailerUploading(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <FormSection
        title={t('thumbnail', { default: 'Thumbnail' })}
        icon={ImageIcon}
        description={t('thumbnailDesc', { default: 'The cover image used on cards, the catalog and social shares. A 16:9 cover is recommended.' })}
      >
      <div className="space-y-1.5">
        {' '}
        <div
          onClick={() => thumbInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setThumbDrag(true);
          }}
          onDragLeave={() => setThumbDrag(false)}
           onDrop={(e) => {
             e.preventDefault();
             e.stopPropagation();
            setThumbDrag(false);
            void handleThumbFile(e.dataTransfer.files?.[0]);
          }}
          className={
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-xs transition ' +
            (thumbDrag
              ? 'border-accent bg-accent/10'
              : 'border-border bg-card hover:border-accent/60')
          }
        >
          {' '}
          {thumbUploading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-4 text-muted-foreground/70" />
          )}{' '}
          <p className="font-sans text-muted-foreground">
            {' '}
            {thumbDrag ? t('dropToUpload', { default: 'Drop to upload' }) : t('dropImageHint', { default: 'Drag & drop an image, or click to upload' })}{' '}
          </p>{' '}
        </div>{' '}
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleThumbFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />{' '}
        {(thumbPreview || course.thumbnailUrl) ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {' '}
            {/* eslint-disable-next-line @next/next/no-img-element */}{' '}
            <img
               src={thumbPreview || course.thumbnailUrl || undefined}
              alt=""
              className="h-28 w-44 rounded-xl object-cover shadow-sm"
            />{' '}
            <button
              type="button"
              onClick={() => { setThumbPreview(null); update({ thumbnailUrl: null }); }}
              className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10 dark:text-destructive"
            >
              {' '}
              {t('remove', { default: 'Remove' })}{' '}
            </button>{' '}
          </div>
        ) : null}{' '}
      </div>{' '}
      </FormSection>{' '}

      <FormSection
        title={t('trailerVideo', { default: 'Trailer video' })}
        icon={Video}
        description={t('trailerDesc', { default: 'A short promo shown on the course page. Optional, but it lifts conversion.' })}
      >
      <div className="space-y-1.5">
        {' '}
        <div
          onClick={() => trailerInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setTrailerDrag(true);
          }}
          onDragLeave={() => setTrailerDrag(false)}
           onDrop={(e) => {
             e.preventDefault();
             e.stopPropagation();
            setTrailerDrag(false);
            void handleTrailerFile(e.dataTransfer.files?.[0]);
          }}
          className={
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-xs transition ' +
            (trailerDrag
              ? 'border-accent bg-accent/10'
              : 'border-border bg-card hover:border-accent/60')
          }
        >
          {' '}
          {trailerUploading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-4 text-muted-foreground/70" />
          )}{' '}
          <p className="font-sans text-muted-foreground">
            {' '}
            {trailerDrag ? t('dropToUpload', { default: 'Drop to upload' }) : t('dropVideoHint', { default: 'Drag & drop a video, or click to upload' })}{' '}
          </p>{' '}
        </div>{' '}
        <input
          ref={trailerInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            void handleTrailerFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />{' '}
        {(trailerPreview || course.trailerUrl) ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {' '}
            <video
              src={trailerPreview || course.trailerUrl || undefined}
              controls
              className="h-40 flex-1 rounded-xl bg-muted object-contain"
            />{' '}
            <button
              type="button"
              onClick={() => { setTrailerPreview(null); update({ trailerUrl: null }); }}
              className="shrink-0 rounded-md px-2.5 py-1 font-sans text-xs font-medium text-destructive transition hover:bg-destructive/10 dark:text-destructive"
            >
              {' '}
              {t('remove', { default: 'Remove' })}{' '}
            </button>{' '}
          </div>
        ) : null}{' '}
      </div>{' '}
      </FormSection>{' '}

      <FormSection
        title={t('courseResources', { default: 'Course resources' })}
        icon={Paperclip}
        description={t('resourcesDesc', { default: 'Downloadable files offered alongside the lessons.' })}
        bodyClassName="p-5"
        actions={
          <button
            type="button"
            onClick={addResource}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted"
          >
            {' '}
            <Plus className="size-4" /> {t('addResource', { default: 'Add resource' })}{' '}
          </button>
        }
      >
      <div className="space-y-3">
        {' '}
        {resources.length === 0 && (
          <p className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
            {' '}
            <Paperclip className="size-4" /> {t('noResources', { default: 'No downloadable resources yet.' })}{' '}
          </p>
        )}{' '}
        <div className="space-y-2">
          {' '}
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-2"
            >
              {' '}
              <input
                value={r.name}
                onChange={(e) => patchResource(r.id, { name: e.target.value })}
                placeholder={t('label', { default: 'Label' })}
                className="w-40 rounded-lg border border-border bg-transparent px-3 py-1.5 font-sans text-sm outline-none focus:ring-2 focus:ring-accent/30"
              />{' '}
              <label className="flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-center font-sans text-xs font-medium text-muted-foreground transition hover:border-accent/50 hover:text-foreground">
                {resourceUploading === r.id ? t('uploading', { default: 'Uploading…' }) : r.url ? t('replaceUploadedFile', { default: 'Replace uploaded file' }) : t('chooseFileToUpload', { default: 'Choose file to upload' })}
                <input
                  type="file"
                  className="sr-only"
                  disabled={resourceUploading === r.id}
                  onChange={(event) => {
                    void handleResourceFile(r.id, event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>{' '}
              <button
                type="button"
                onClick={() => removeResource(r.id)}
                aria-label={t('removeResource', { default: 'Remove resource' })}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                {' '}
                <X className="size-4" />{' '}
              </button>{' '}
            </div>
          ))}{' '}
        </div>{' '}
      </div>{' '}
      </FormSection>{' '}
    </div>
  );
}
