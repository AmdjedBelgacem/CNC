'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { spring, transition } from '@/lib/motion';
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
  const t = useTranslations('admin.academiesNew.upload');
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
          'relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed px-4 py-5 text-center text-xs transition-[background-color,border-color,transform] duration-300',
          drag
            ? 'scale-[1.01] border-primary/60 bg-primary/5'
            : pending
              ? 'border-success/40 bg-success/5'
              : 'border-border bg-surface-sunken/60 hover:border-border-strong hover:bg-muted/60',
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
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-2xs font-medium text-success">
              <ImageIcon className="size-3.5" /> {t('selected')}
            </span>
          ) : (
            <Upload className="size-5 text-muted-foreground/70" />
          )}
          {pending ? (
            <img
              src={pending.preview}
              alt=""
              className="mt-1 h-20 w-20 rounded-lg border-2 border-card bg-card object-cover shadow-md"
            />
          ) : null}
          <p className="font-sans font-medium text-foreground">
            {pending ? pending.file.name : drag ? t('dropToAdd') : t('dragDropOrClick')}
          </p>
          <p className="max-w-[36ch] text-2xs leading-4 text-muted-foreground/70">{hint}</p>
          <p className="text-2xs text-muted-foreground/50">{t('urlDisabled')}</p>
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
      <AnimatePresence initial={false} mode="popLayout">
      {pending ? (
        <m.div
          key="pending"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: spring.smooth }}
          exit={{ opacity: 0, y: -4, transition: transition.leave }}
          className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-sunken/60 p-2.5"
        >
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
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </m.div>
      ) : (
        <m.p
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: transition.crossfade }}
          exit={{ opacity: 0, transition: transition.leave }}
          className="text-xs text-muted-foreground"
        >
          {t('noFileSelected')}
        </m.p>
      )}
      </AnimatePresence>
    </div>
  );
}

export default function NewAcademyPage() {
  const router = useRouter();
  const t = useTranslations('admin.academiesNew');
  const tAdmin = useTranslations('admin');
  const tAcademiesPage = useTranslations('admin.academiesPage');
  const tEditor = useTranslations('admin.academiesPage.editor');
  const tCommon = useTranslations('common');
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
      toast({ type: 'err', title: tEditor('notAnImage') });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({
        type: 'err',
        title: tEditor('fileTooLarge'),
        description: t('fileTooLargeHint'),
      });
      return;
    }
    const preview = await readFileAsDataUrl(f);
    setter({ file: f, preview });
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ type: 'err', title: t('titleRequired') });
      return;
    }
    setBusy(true);
    try {
      const slug = slugify(title);
      const created = await api.post<{ slug: string }>('/admin/academies', {
        slug,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        accentColor: accentColor || undefined,
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDescription.trim() || undefined,
      });
      const newSlug: string = created.slug;

      const uploads: Array<{ kind: 'hero' | 'logo' | 'seo'; pending: PendingFile }> = [
        { kind: 'hero', pending: hero },
        { kind: 'logo', pending: logo },
        { kind: 'seo', pending: seoImg },
      ];
      for (const u of uploads) {
        if (!u.pending) continue;
        const dataUrl = u.pending.preview; // already dataUrl
        // A failed image must not abort the remaining uploads or the create itself,
        // so this one is reported and swallowed rather than thrown.
        try {
          await api.post(`/admin/academies/${newSlug}/images`, {
            kind: u.kind,
            image: dataUrl,
            filename: u.pending.file.name,
          });
        } catch (err: any) {
          const d = err?.body ?? null;
          toast({ type: 'err', title: t('uploadFailedFor', { label: t(u.kind) }), description: d?.message ?? err?.message });
        }
      }

      toast({ type: 'ok', title: t('created') });
      router.replace(`/admin/academies/${newSlug}/edit`);
    } catch (e: any) {
      toast({ type: 'err', title: t('createFailed'), description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <AdminCommandBar
        trail={[
          { label: tAdmin('academies'), href: '/admin/academies' },
          { label: tAcademiesPage('newAcademy') },
        ]}
        live={tAdmin('live')}
        actions={
          <BarButton onClick={() => router.push('/admin/academies')}>{tCommon('cancel')}</BarButton>
        }
        primary={
          <BarPrimaryButton
            icon={busy ? <Loader2 className="size-4 animate-spin" /> : undefined}
            disabled={busy || !title.trim()}
            onClick={() => void submit()}
          >
            {busy ? t('creating') : t('createAcademy')}
          </BarPrimaryButton>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 pt-6">
        <AdminPageHeader
          title={tAcademiesPage('newAcademy')}
          description={t('description')}
          badge={
            <span className="flex items-center gap-2 self-start rounded-full border border-border/70 bg-surface-sunken px-3 py-1.5 text-xs font-medium text-muted-foreground md:self-auto">
              <ImageIcon className="size-4" />
              {t('uploadOnlyMedia')}
            </span>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal as="section" className="space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
            <h2 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              {tEditor('basics')}
            </h2>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('titleLabel')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {tEditor('slug')}
              </span>
              <input
                value={slugify(title)}
                readOnly
                className="h-9 w-full rounded-xl border border-border bg-muted px-3 font-mono text-sm text-muted-foreground outline-none"
              />
              <span className="text-2xs text-muted-foreground">
                {t('slugHint', { slug: slugify(title) })}
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {tEditor('subtitle')}
              </span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {tEditor('description')}
              </span>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </label>
          </Reveal>

          <Reveal as="section" delay={0.06} className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
            <h2 className="font-display text-lg font-medium tracking-[-0.015em] text-foreground">
              {t('brandingSeo')}
            </h2>
            <UploadPick
              label={tEditor('heroBanner')}
              hint={t('heroHint')}
              pending={hero}
              onPick={(f) => void makePreview(f, setHero)}
              onClear={() => setHero(null)}
            />
            <UploadPick
              label={tEditor('logo')}
              hint={t('logoHint')}
              pending={logo}
              onPick={(f) => void makePreview(f, setLogo)}
              onClear={() => setLogo(null)}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t('accentColor')}
              </span>
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
                  className="h-9 flex-1 rounded-xl border border-border/80 bg-background px-3 font-mono text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </label>
            <div className="h-px bg-border/70" />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {tEditor('seoTitle')}
              </span>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={t('seoTitlePlaceholder')}
                className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {tEditor('seoDescription')}
              </span>
              <textarea
                rows={3}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <UploadPick
              label={t('socialImageLabel')}
              hint={t('socialImageHint')}
              pending={seoImg}
              onPick={(f) => void makePreview(f, setSeoImg)}
              onClear={() => setSeoImg(null)}
            />
          </Reveal>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/academies')}
            className="rounded-xl border border-border/70 bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-xs transition hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !title.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition active:scale-[0.98] disabled:opacity-50',
              busy || !title.trim()
                ? 'bg-muted-foreground/40'
                : 'bg-primary shadow-xs hover:bg-primary/90',
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? t('creating') : t('createAcademy')}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">{t('storageNote')}</p>
      </div>
    </div>
  );
}
