'use client';
import { useState, useRef } from 'react';
import { Plus, X, Paperclip, Upload, Loader2 } from 'lucide-react';
import { LABEL } from './glass';
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
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
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
  const [thumbUploading, setThumbUploading] = useState(false);
  const [trailerUploading, setTrailerUploading] = useState(false);
  const [thumbDrag, setThumbDrag] = useState(false);
  const [trailerDrag, setTrailerDrag] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const handleThumbFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: 'Not an image', description: 'Please choose an image file.' });
      return;
    }
    setThumbUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.uploadFile(dataUrl, 'covers', file.name);
      update({ thumbnailUrl: res.url });
      toast({ type: 'ok', title: 'Thumbnail uploaded' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Upload failed', description: e?.message });
    } finally {
      setThumbUploading(false);
    }
  };
  const handleTrailerFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ type: 'err', title: 'Not a video', description: 'Please choose a video file.' });
      return;
    }
    setTrailerUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.uploadFile(dataUrl, 'trailers', file.name);
      update({ trailerUrl: res.url });
      toast({ type: 'ok', title: 'Trailer uploaded' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Upload failed', description: e?.message });
    } finally {
      setTrailerUploading(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Thumbnail *</label>{' '}
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
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-xs transition ' +
            (thumbDrag
              ? 'border-accent bg-accent/10'
              : 'border-border bg-card hover:border-accent/60')
          }
        >
          {' '}
          {thumbUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground/70" />
          )}{' '}
          <p className="font-sans text-muted-foreground">
            {' '}
            {thumbDrag ? 'Drop to upload' : 'Drag & drop an image, or click to upload'}{' '}
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
        {course.thumbnailUrl ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {' '}
            {/* eslint-disable-next-line @next/next/no-img-element */}{' '}
            <img
              src={course.thumbnailUrl}
              alt=""
              className="h-28 w-44 rounded-xl object-cover shadow-sm"
            />{' '}
            <button
              type="button"
              onClick={() => update({ thumbnailUrl: null })}
              className="rounded-md px-2.5 py-1 font-sans text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              {' '}
              Remove{' '}
            </button>{' '}
          </div>
        ) : (
          <p className="font-sans text-xs text-muted-foreground">
            A 16:9 cover image is recommended.
          </p>
        )}{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Trailer video</label>{' '}
        <div
          onClick={() => trailerInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setTrailerDrag(true);
          }}
          onDragLeave={() => setTrailerDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
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
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground/70" />
          )}{' '}
          <p className="font-sans text-muted-foreground">
            {' '}
            {trailerDrag ? 'Drop to upload' : 'Drag & drop a video, or click to upload'}{' '}
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
        {course.trailerUrl ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {' '}
            <video
              src={course.trailerUrl}
              controls
              className="h-40 flex-1 rounded-xl bg-muted object-contain"
            />{' '}
            <button
              type="button"
              onClick={() => update({ trailerUrl: null })}
              className="shrink-0 rounded-md px-2.5 py-1 font-sans text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              {' '}
              Remove{' '}
            </button>{' '}
          </div>
        ) : null}{' '}
      </div>{' '}
      <div className="space-y-3">
        {' '}
        <div className="flex items-center justify-between">
          {' '}
          <label className={LABEL}>Course resources</label>{' '}
          <button
            type="button"
            onClick={addResource}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 font-sans text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            {' '}
            <Plus className="h-4 w-4" /> Add resource{' '}
          </button>{' '}
        </div>{' '}
        {resources.length === 0 && (
          <p className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
            {' '}
            <Paperclip className="h-4 w-4" /> No downloadable resources yet.{' '}
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
                placeholder="Label"
                className="w-40 rounded-lg border border-border bg-transparent px-3 py-1.5 font-sans text-sm outline-none focus:ring-2 focus:ring-accent/30"
              />{' '}
              <input
                value={r.url}
                onChange={(e) => patchResource(r.id, { url: e.target.value })}
                placeholder="https://…/file.pdf"
                className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 font-sans text-sm outline-none focus:ring-2 focus:ring-accent/30"
              />{' '}
              <button
                type="button"
                onClick={() => removeResource(r.id)}
                aria-label="Remove resource"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
              >
                {' '}
                <X className="h-4 w-4" />{' '}
              </button>{' '}
            </div>
          ))}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
