'use client';
import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { INPUT, LABEL } from './glass';
import type { CourseStudioData } from './types';
import * as api from './api';
import { toast } from '@/components/ui/toast';
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}
export function StepSeo({
  course,
  update,
}: {
  course: CourseStudioData;
  update: (patch: Partial<CourseStudioData>) => void;
}) {
  const seoDescLen = (course.seoDescription ?? '').length;
  const [ogUploading, setOgUploading] = useState(false);
  const [ogDrag, setOgDrag] = useState(false);
  const ogInputRef = useRef<HTMLInputElement>(null);
  const handleOgFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ type: 'err', title: 'Not an image', description: 'Please choose an image file.' });
      return;
    }
    setOgUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.uploadFile(dataUrl, 'og', file.name);
      update({ ogImageUrl: res.url });
      toast({ type: 'ok', title: 'Image uploaded' });
    } catch (e: any) {
      toast({ type: 'err', title: 'Upload failed', description: e?.message });
    } finally {
      setOgUploading(false);
    }
  };
  return (
    <div className="space-y-6">
      {' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>SEO title</label>{' '}
        <input
          value={course.seoTitle ?? ''}
          onChange={(e) => update({ seoTitle: e.target.value || null })}
          placeholder="Appears in search results & browser tabs"
          className={INPUT}
        />{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <div className="flex items-center justify-between">
          {' '}
          <label className={LABEL}>SEO description</label>{' '}
          <span
            className={
              'font-sans text-xs ' + (seoDescLen > 160 ? 'text-amber-600' : 'text-muted-foreground')
            }
          >
            {' '}
            {seoDescLen}/160{' '}
          </span>{' '}
        </div>{' '}
        <textarea
          value={course.seoDescription ?? ''}
          onChange={(e) => update({ seoDescription: e.target.value || null })}
          rows={3}
          placeholder="A concise summary for search engines"
          className={INPUT + ' resize-y'}
        />{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Keywords</label>{' '}
        <input
          value={course.seoKeywords ?? ''}
          onChange={(e) => update({ seoKeywords: e.target.value || null })}
          placeholder="cnc, machining, manufacturing"
          className={INPUT}
        />{' '}
      </div>{' '}
      <div className="space-y-1.5">
        {' '}
        <label className={LABEL}>Social preview image (OG)</label>{' '}
        <div
          onClick={() => ogInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOgDrag(true);
          }}
          onDragLeave={() => setOgDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOgDrag(false);
            void handleOgFile(e.dataTransfer.files?.[0]);
          }}
          className={
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-xs transition ' +
            (ogDrag
              ? 'border-accent bg-accent/10'
              : 'border-border bg-card hover:border-accent/60')
          }
        >
          {' '}
          {ogUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground/70" />
          )}{' '}
          <p className="font-sans text-muted-foreground">
            {' '}
            {ogDrag ? 'Drop to upload' : 'Drag & drop an image, or click to upload'}{' '}
          </p>{' '}
        </div>{' '}
        <input
          ref={ogInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleOgFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />{' '}
        {course.ogImageUrl ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            {' '}
            {/* eslint-disable-next-line @next/next/no-img-element */}{' '}
            <img
              src={course.ogImageUrl}
              alt=""
              className="h-28 w-44 rounded-xl object-cover shadow-sm"
            />{' '}
            <button
              type="button"
              onClick={() => update({ ogImageUrl: null })}
              className="shrink-0 rounded-md px-2.5 py-1 font-sans text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              {' '}
              Remove{' '}
            </button>{' '}
          </div>
        ) : null}{' '}
      </div>{' '}
      <div className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-muted-foreground">
        {' '}
        Final URL:{' '}
        <span className="font-mono text-foreground">/courses/{course.slug || 'slug'}</span>{' '}
      </div>{' '}
    </div>
  );
}
