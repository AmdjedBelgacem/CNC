'use client';
import { useState } from 'react';
import { UploadCloud, Trash2 } from 'lucide-react';
import { uploadImage } from '@/lib/upload';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

interface ImageUploadControlProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ImageUploadControl({
  value,
  onChange,
}: ImageUploadControlProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(5);
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 85));
    }, 200);
    try {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.type)) {
        throw new Error('Unsupported image type. Use JPEG, PNG, WebP or GIF.');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image is larger than 10 MB.');
      }
      const result = await uploadImage(file, 'covers');
      setProgress(100);
      onChange(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      clearInterval(tick);
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/40">
          <img src={value} alt="preview" className="h-28 w-full object-cover" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <label
          className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 text-sm font-medium text-primary transition hover:bg-primary/10 ${
            uploading ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <UploadCloud className="size-4" />
          {uploading ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        {value ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => onChange('')}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-destructive/30 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
            title="Remove image"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      {uploading ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {value ? (
        <p className="truncate text-[10px] text-muted-foreground" title={value}>
          {value}
        </p>
      ) : null}
    </div>
  );
}
