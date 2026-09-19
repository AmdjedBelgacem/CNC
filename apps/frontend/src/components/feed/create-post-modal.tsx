'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { Image, X, Loader2 } from 'lucide-react';
interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}
export function CreatePostModal({ open, onClose, onCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  if (!open) return null;
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const key = `feed/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const presigned = await fetch('/api/proxy/upload/presigned', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, contentType: file.type }),
        }).then((r) => r.json());
        await fetch(presigned.url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        const downloadUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL || 'http://localhost:9000'}/${process.env.NEXT_PUBLIC_S3_BUCKET || 'cnc-uploads'}/${key}`;
        urls.push(downloadUrl);
      }
      setMediaFiles((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const handleSubmit = async () => {
    if (!content.trim() && mediaFiles.length === 0) return;
    setPosting(true);
    try {
      await fetch('/api/proxy/feed', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrls: mediaFiles.length > 0 ? mediaFiles : undefined,
        }),
      });
      setContent('');
      setMediaFiles([]);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Post failed', err);
    } finally {
      setPosting(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-gray-900"
      onClick={onClose}
    >
      {' '}
      <div
        className="w-full max-w-lg rounded-xl border bg-card shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {' '}
        <div className="flex items-center justify-between border-b px-4 py-3">
          {' '}
          <h2 className="font-semibold">Create Post</h2>{' '}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            {' '}
            <X className="h-4 w-4" />{' '}
          </Button>{' '}
        </div>{' '}
        <div className="p-4">
          {' '}
          <div className="flex gap-3">
            {' '}
            <Avatar className="h-10 w-10">
              {' '}
              <AvatarImage
                src={
                  user?.name
                    ? `https://ui-avatars.com/api/?name=${user.name}&background=random`
                    : undefined
                }
              />{' '}
              <AvatarFallback>{(user?.name || 'You')[0]}</AvatarFallback>{' '}
            </Avatar>{' '}
            <textarea
              placeholder="Share something with the community..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none resize-none min-h-[100px] placeholder:text-muted-foreground"
              autoFocus
            />{' '}
          </div>{' '}
          {mediaFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {' '}
              {mediaFiles.map((url, i) => (
                <div key={i} className="relative">
                  {' '}
                  <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />{' '}
                  <button
                    onClick={() => setMediaFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5"
                  >
                    {' '}
                    <X className="h-3 w-3" />{' '}
                  </button>{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
        </div>{' '}
        <div className="flex items-center justify-between border-t px-4 py-3">
          {' '}
          <div className="flex items-center gap-2">
            {' '}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />{' '}
            <Button
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {' '}
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Image className="h-4 w-4 mr-1" />
              )}{' '}
              Photo{' '}
            </Button>{' '}
          </div>{' '}
          <Button
            size="sm"
            disabled={(!content.trim() && mediaFiles.length === 0) || posting}
            onClick={handleSubmit}
          >
            {' '}
            {posting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Post{' '}
          </Button>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
