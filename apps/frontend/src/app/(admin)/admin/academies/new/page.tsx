'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  AdminCommandBar,
  BarButton,
  BarPrimaryButton,
  AdminPageHeader,
} from '@/components/admin/admin-chrome';

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'academy-' + Date.now().toString(36)
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

type PendingFile = { file: File; preview: string } | null;

function UploadPick({
  label,
  hint,
  pending,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  pending: PendingFile;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed px-4 py-4 text-center text-xs transition',
          drag
            ? 'border-primary bg-primary/5'
            : pending
              ? 'border-success/40 bg-success/40 '
              : 'border-border bg-muted/50 hover:bg-muted',
        )}
      >
        {pending ? (
          <img
            src={pending.preview}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.15]"
          />
        ) : null}
        {drag ? <div className="absolute inset-0 bg-primary/10" /> : null}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          {pending ? (
            <span className="flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-2xs font-bold text-success-foreground shadow">
              <ImageIcon className="size-3.5" /> Selected — visible here
            </span>
          ) : (
            <Upload className="size-5 text-muted-foreground/70" />
          )}
          {pending ? (
            <img
              src={pending.preview}
              alt=""
              className="mt-1 h-20 w-20 rounded-lg border-2 border-white bg-card object-cover shadow-md"
            />
          ) : null}
          <p className="font-sans font-medium text-foreground">
            {pending ? pending.file.name : drag ? 'Drop to add' : 'Drag & drop or click to upload'}
          </p>
          <p className="max-w-[36ch] text-2xs leading-4 text-muted-foreground/70">{hint}</p>
          <p className="text-2xs text-muted-foreground/50">
            Only file upload — pasting a URL is disabled.
          </p>
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      {pending ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pending.preview}
            alt=""
            className="h-16 w-16 rounded-lg border bg-card object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {pending.file.name}{' '}
            <span className="text-muted-foreground">
              ({Math.round(pending.file.size / 1024)}KB)
            </span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No file selected.</p>
      )}
    </div>
  );
}

export default function NewAcademyPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState('#0E7490');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [hero, setHero] = useState<PendingFile>(null);
  const [logo, setLogo] = useState<PendingFile>(null);
  const [seoImg, setSeoImg] = useState<PendingFile>(null);
  const [busy, setBusy] = useState(false);

  const makePreview = async (f: File, setter: (v: PendingFile) => void) => {
    if (!f.type.startsWith('image/')) {
      toast({ type: 'err', title: 'Not an image' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ type: 'err', title: 'File too large', description: 'Max 5 MB' });
      return;
    }
    const preview = await readFileAsDataUrl(f);
    setter({ file: f, preview });
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ type: 'err', title: 'Title required' });
      return;
    }
    setBusy(true);
    try {
      const slug = slugify(title);
      const res = await fetch('/api/proxy/admin/academies', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined,
          accentColor: accentColor || undefined,
          seoTitle: seoTitle.trim() || undefined,
          seoDescription: seoDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? `Create failed (${res.status})`);
      }
      const created = await res.json();
      const newSlug: string = created.slug;

      const uploads: Array<{ kind: 'hero' | 'logo' | 'seo'; pending: PendingFile }> = [
        { kind: 'hero', pending: hero },
        { kind: 'logo', pending: logo },
        { kind: 'seo', pending: seoImg },
      ];
      for (const u of uploads) {
        if (!u.pending) continue;
        const dataUrl = u.pending.preview; // already dataUrl
        const r = await fetch(`/api/proxy/admin/academies/${newSlug}/images`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: u.kind, image: dataUrl, filename: u.pending.file.name }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          toast({ type: 'err', title: `${u.kind} upload failed`, description: d?.message });
        }
      }

      toast({ type: 'ok', title: 'Academy created' });
      router.replace(`/admin/academies/${newSlug}/edit`);
    } catch (e: any) {
      toast({ type: 'err', title: 'Create failed', description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[{ label: 'Academies', href: '/admin/academies' }, { label: 'New academy' }]}
        live="Live"
        actions={<BarButton onClick={() => router.push('/admin/academies')}>Cancel</BarButton>}
        primary={
          <BarPrimaryButton
            icon={busy ? <Loader2 className="size-4 animate-spin" /> : undefined}
            disabled={busy || !title.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Creating…' : 'Create academy'}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 pt-6">
        <AdminPageHeader
          title="New academy"
          description="Create a branded destination — images are upload-only, no URL pasting."
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground md:self-auto">
              <ImageIcon className="size-4" />
              Upload-only media
            </span>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Basics
            </h2>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Title *</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CNC Milling Academy"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Slug</span>
              <input
                value={slugify(title)}
                readOnly
                className="h-9 w-full rounded-xl border border-border bg-muted px-3 font-mono text-sm text-muted-foreground outline-none"
              />
              <span className="text-2xs text-muted-foreground">
                Auto-generated from title — /academy/{slugify(title)}
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Subtitle</span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Description</span>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
          </section>

          <section className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Branding & SEO — upload only
            </h2>
            <UploadPick
              label="Hero banner"
              hint="1920×1080 · JPG/PNG/WebP/AVIF · ≤5 MB"
              pending={hero}
              onPick={(f) => void makePreview(f, setHero)}
              onClear={() => setHero(null)}
            />
            <UploadPick
              label="Logo / mark"
              hint="Square transparent PNG/WebP · ≤5 MB"
              pending={logo}
              onPick={(f) => void makePreview(f, setLogo)}
              onClear={() => setLogo(null)}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Accent color</span>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-border bg-background"
                />
                <input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </label>
            <div className="h-px bg-border" />
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">SEO title</span>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Custom <title> for search"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">SEO description</span>
              <textarea
                rows={3}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <UploadPick
              label="Social preview image (og:image)"
              hint="1200×630 · ≤5 MB · for link unfurls"
              pending={seoImg}
              onPick={(f) => void makePreview(f, setSeoImg)}
              onClear={() => setSeoImg(null)}
            />
          </section>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/academies')}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !title.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50',
              busy || !title.trim()
                ? 'bg-muted-foreground/40'
                : 'bg-primary shadow-xs hover:bg-primary/90',
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? 'Creating…' : 'Create academy'}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          All images are stored tenant-scoped on the server (or S3 if configured). External image
          URLs are rejected by the API.
        </p>
      </div>
    </div>
  );
}
