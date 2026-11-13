'use client';
import { PortfolioLoading } from '@/components/skeletons/public-page-replicas';
import { rememberListCount } from '@/lib/admin-shape-memory';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/motion';
import { AnimatePresence, m } from 'framer-motion';
import { spring, transition } from '@/lib/motion';
import { SettingsBanner, SettingsHeader } from '../_components/settings-ui';
import { toast } from '@/components/ui/toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  X,
  Image as ImageIcon,
  User,
  MapPin,
  FileText,
  Briefcase,
  Link2,
  Check,
  AlertCircle,
} from 'lucide-react';
interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  projectUrl: string | null;
  tags: string[] | null;
  sortOrder: number;
}
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export default function EditProfilePage() {
  const t = useTranslations('account');
  const { user, refreshProfile } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: '', username: '', headline: '', bio: '', location: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  // The loading placeholder draws as many portfolio cards as were listed last time.
  useEffect(() => {
    if (!portfolioLoading) rememberListCount('settings-portfolio', portfolio.length);
  }, [portfolioLoading, portfolio.length]);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [pfForm, setPfForm] = useState({
    title: '',
    description: '',
    projectUrl: '',
    image: '',
    tags: '',
  });
  const [pfSaving, setPfSaving] = useState(false);
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        username: user.username || '',
        headline: user.headline || '',
        bio: user.bio || '',
        location: user.location || '',
      });
      setAvatarPreview(user.avatarUrl);
      setCoverPreview(null);
    }
  }, [user]);
  useEffect(() => {
    loadPortfolio();
  }, []);
  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const res = await apiProxyFetch('/api/proxy/portfolio');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPortfolio(data);
      }
    } catch {
    } finally {
      setPortfolioLoading(false);
    }
  };
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setAvatarPreview(dataUrl);
    setUploading(true);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/upload-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error(t('profile.uploadFailed'));
      const data = await res.json();
      setAvatarPreview(data.avatarUrl);
      await refreshProfile();
      toast({ type: 'ok', title: t('profile.avatarUpdatedToast') });
    } catch {
      setError(t('profile.avatarUploadFailed'));
      toast({ type: 'err', title: t('profile.avatarUploadFailed') });
    } finally {
      setUploading(false);
    }
  };
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setCoverPreview(dataUrl);
    setUploading(true);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/upload-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error(t('profile.uploadFailed'));
      await refreshProfile();
      toast({ type: 'ok', title: t('profile.coverUpdatedToast') });
    } catch {
      setError(t('profile.coverUploadFailed'));
      toast({ type: 'err', title: t('profile.coverUploadFailed') });
    } finally {
      setUploading(false);
    }
  };
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('profile.saveFailed'));
      }
      setSaved(true);
      await refreshProfile();
      toast({ type: 'ok', title: t('profile.savedToast') });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.saveFailed');
      setError(message);
      toast({ type: 'err', title: t('profile.saveFailed'), description: message });
    } finally {
      setSaving(false);
    }
  };
  const resetPfForm = () => {
    setPfForm({ title: '', description: '', projectUrl: '', image: '', tags: '' });
    setEditingPortfolioId(null);
    setShowPortfolioForm(false);
  };
  const handlePortfolioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfForm.title.trim()) return;
    setPfSaving(true);
    try {
      // Always send these keys on edit, including empty values. The backend only writes
      // keys that are `!== undefined`, so omitting a cleared field left the old value
      // in the database and the user could never remove a description or URL.
      const body: Record<string, unknown> = {
        title: pfForm.title,
        description: pfForm.description,
        projectUrl: pfForm.projectUrl,
        tags: pfForm.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
      };
      // image is intentionally omitted when empty: sending '' would wipe the stored file.
      if (pfForm.image) body.image = pfForm.image;
      const url = editingPortfolioId
        ? `/api/proxy/portfolio/${editingPortfolioId}`
        : '/api/proxy/portfolio';
      const method = editingPortfolioId ? 'PUT' : 'POST';
      const res = await apiProxyFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          typeof detail?.message === 'string' ? detail.message : t('profile.savePortfolioFailed'),
        );
      }
      await loadPortfolio();
      resetPfForm();
      toast({ type: 'ok', title: t('profile.portfolioSavedToast') });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.savePortfolioFailed');
      setError(message);
      toast({ type: 'err', title: t('profile.savePortfolioFailed'), description: message });
    } finally {
      setPfSaving(false);
    }
  };
  const handleDeletePortfolio = async (id: string) => {
    try {
      const res = await apiProxyFetch(`/api/proxy/portfolio/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('profile.deleteFailed'));
      await loadPortfolio();
      toast({ type: 'ok', title: t('profile.portfolioDeletedToast') });
    } catch {
      setError(t('profile.deletePortfolioFailed'));
      toast({ type: 'err', title: t('profile.deletePortfolioFailed') });
    }
  };
  const handleMovePortfolio = async (id: string, direction: 'up' | 'down') => {
    const idx = portfolio.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= portfolio.length) return;
    const newPortfolio = [...portfolio];
    const temp = newPortfolio[idx]!;
    newPortfolio[idx] = newPortfolio[swapIdx]!;
    newPortfolio[swapIdx] = temp;
    const reordered = newPortfolio.map((item, i) => ({ id: item.id, sortOrder: i }));
    try {
      const res = await apiProxyFetch('/api/proxy/portfolio/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reordered }),
      });
      if (res.ok) setPortfolio(newPortfolio);
      else throw new Error(t('profile.portfolioReorderFailed'));
    } catch {
      toast({ type: 'err', title: t('profile.portfolioReorderFailed') });
    }
  };
  const handleEditPortfolio = (item: PortfolioItem) => {
    setPfForm({
      title: item.title,
      description: item.description || '',
      projectUrl: item.projectUrl || '',
      image: '',
      tags: item.tags?.join(', ') || '',
    });
    setEditingPortfolioId(item.id);
    setShowPortfolioForm(true);
  };
  const handlePortfolioImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setPfForm({ ...pfForm, image: dataUrl });
  };
  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={User}
        title={t('profile.pageTitle')}
        subtitle={t('profile.pageSubtitle')}
      />
      <SettingsBanner show={!!error} tone="error" icon={AlertCircle} role="alert">
        {error}
      </SettingsBanner>
      <SettingsBanner show={!!saved} tone="success" icon={Check} role="status">
        {t('profile.savedToast')}
      </SettingsBanner>
      {/* Cover & Avatar */}
      <Reveal
        as="section"
        className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
      >
        <div className="relative h-40 sm:h-48 bg-muted">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt={t('profile.coverAlt')}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10">
              <ImageIcon className="size-8 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/15 to-transparent" />
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 end-3 flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur transition hover:bg-card"
          >
            <Camera className="size-3.5" /> {t('profile.changeCover')}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
          <div className="absolute -bottom-10 start-6 flex items-end gap-3">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-card shadow-lg">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="bg-primary/10 font-display text-lg font-medium text-primary">
                  {user?.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card hover:bg-primary/90 transition"
                disabled={uploading}
              >
                <Camera className="size-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 pt-12">
          <h3 className="font-display text-xl font-medium tracking-[-0.015em]">
            {user?.name || t('profile.yourName')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {user?.headline || t('profile.addHeadline')}
          </p>
        </div>
      </Reveal>
      {/* Profile Info */}
      <Reveal
        as="section"
        className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
      >
        <div className="border-b border-border/60 px-6 pb-4 pt-5">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-medium tracking-[-0.012em] text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-3.5" />
            </span>
            {t('profile.infoTitle')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('profile.infoDesc')}</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t('profile.displayName')}
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t('profile.username')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="h-10 ps-7"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('profile.headline')}</label>
              <Input
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder={t('profile.headlinePlaceholder')}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('profile.bio')}</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                className="flex w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus:border-ring/60 focus:outline-none focus:ring-4 focus:ring-ring/15"
                placeholder={t('profile.bioPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {t('profile.location')}
              </label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t('profile.locationPlaceholder')}
                className="h-10"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving || uploading}
                className="h-9 rounded-full px-6"
              >
                {saving ? t('saving') : t('saveChanges')}
              </Button>
            </div>
          </form>
        </div>
      </Reveal>
      {/* Portfolio */}
      <Reveal
        as="section"
        className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 pb-4 pt-5">
          <div>
            <h2 className="flex items-center gap-2.5 font-display text-lg font-medium tracking-[-0.012em] text-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Briefcase className="size-3.5" />
              </span>
              {t('profile.portfolio')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('profile.portfolioDesc')}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setPfForm({ title: '', description: '', projectUrl: '', image: '', tags: '' });
              setEditingPortfolioId(null);
              setShowPortfolioForm(true);
            }}
            className="h-8 rounded-full gap-1.5"
          >
            <Plus className="size-3.5" /> {t('profile.portfolioAdd')}
          </Button>
        </div>
        <div className="p-6 space-y-4">
          <AnimatePresence initial={false}>
            {showPortfolioForm && (
              <m.form
                key="portfolio-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: transition.enter }}
                exit={{ opacity: 0, height: 0, transition: transition.leave }}
                onSubmit={handlePortfolioSubmit}
                className="overflow-hidden"
              >
                <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {t('profile.titleRequired')}
                    </label>
                    <Input
                      value={pfForm.title}
                      onChange={(e) => setPfForm({ ...pfForm, title: e.target.value })}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {t('profile.description')}
                    </label>
                    <textarea
                      value={pfForm.description}
                      onChange={(e) => setPfForm({ ...pfForm, description: e.target.value })}
                      rows={3}
                      className="flex w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong focus:border-ring/60 focus:outline-none focus:ring-4 focus:ring-ring/15"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        {t('profile.projectUrl')}
                      </label>
                      <div className="relative">
                        <Link2 className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={pfForm.projectUrl}
                          onChange={(e) => setPfForm({ ...pfForm, projectUrl: e.target.value })}
                          placeholder="https://..."
                          className="h-10 ps-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        {t('profile.tags')}
                      </label>
                      <Input
                        value={pfForm.tags}
                        onChange={(e) => setPfForm({ ...pfForm, tags: e.target.value })}
                        placeholder="CNC, CAD"
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {t('profile.image')}
                    </label>
                    {pfForm.image ? (
                      <div className="relative inline-block">
                        <img
                          src={pfForm.image}
                          alt={t('profile.imageAlt')}
                          className="h-24 w-36 rounded-lg border border-border/70 object-cover shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setPfForm({ ...pfForm, image: '' })}
                          className="absolute -end-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-muted/30 transition-colors hover:bg-muted/60">
                        <ImageIcon className="size-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t('profile.uploadImage')}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePortfolioImage}
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={pfSaving || !pfForm.title.trim()}
                      className="rounded-full"
                    >
                      {pfSaving
                        ? t('saving')
                        : editingPortfolioId
                          ? t('profile.update')
                          : t('profile.addProject')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setPfForm({
                          title: '',
                          description: '',
                          projectUrl: '',
                          image: '',
                          tags: '',
                        });
                        setEditingPortfolioId(null);
                        setShowPortfolioForm(false);
                      }}
                      className="rounded-full"
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              </m.form>
            )}
          </AnimatePresence>
          {portfolioLoading ? (
            <PortfolioLoading />
          ) : portfolio.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-8 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 font-display text-base font-medium">
                {t('profile.noPortfolioItems')}
              </p>
              <p className="text-xs text-muted-foreground">{t('profile.noPortfolioItemsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((item, idx) => (
                <m.div
                  key={item.id}
                  layout
                  transition={spring.layout}
                  className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="pe-2 font-display text-base font-medium leading-tight">
                      {item.title}
                    </h3>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleMovePortfolio(item.id, 'up')}
                        disabled={idx === 0}
                        className="rounded-lg p-1 hover:bg-muted disabled:opacity-30"
                      >
                        <GripVertical className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleEditPortfolio(item)}
                        className="rounded-lg p-1 hover:bg-muted"
                      >
                        <span className="text-xs">✎</span>
                      </button>
                      <button
                        onClick={() => handleDeletePortfolio(item.id)}
                        className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="mt-3 h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.filter(Boolean).map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-2xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.projectUrl && (
                    <a
                      href={item.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" /> {t('profile.viewProject')}
                    </a>
                  )}
                </m.div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
