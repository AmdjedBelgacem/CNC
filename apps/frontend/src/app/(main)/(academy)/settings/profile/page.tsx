'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAvatarPreview(data.avatarUrl);
      await refreshProfile();
    } catch {
      setError('Failed to upload avatar');
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
      if (!res.ok) throw new Error('Upload failed');
      await refreshProfile();
    } catch {
      setError('Failed to upload cover');
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
        throw new Error(data.message || 'Failed to save');
      }
      setSaved(true);
      await refreshProfile();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
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
      const body: any = { title: pfForm.title };
      if (pfForm.description) body.description = pfForm.description;
      if (pfForm.projectUrl) body.projectUrl = pfForm.projectUrl;
      if (pfForm.tags)
        body.tags = pfForm.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
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
      if (!res.ok) throw new Error('Failed to save');
      await loadPortfolio();
      resetPfForm();
    } catch {
      setError('Failed to save portfolio item');
    } finally {
      setPfSaving(false);
    }
  };
  const handleDeletePortfolio = async (id: string) => {
    try {
      const res = await apiProxyFetch(`/api/proxy/portfolio/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await loadPortfolio();
    } catch {
      setError('Failed to delete portfolio item');
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
    } catch {}
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
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <User className="h-5 w-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Edit Profile</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your public presence across the platform — make it count.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {error && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}{' '}
      {saved && (
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0 mt-0.5" /> Profile updated successfully.
        </div>
      )}{' '}
      {/* Cover & Avatar */}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="relative h-40 sm:h-48 bg-muted">
          {' '}
          {coverPreview ? (
            <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-primary/10">
              {' '}
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />{' '}
            </div>
          )}{' '}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />{' '}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-md hover:bg-card transition"
          >
            {' '}
            <Camera className="h-3.5 w-3.5" /> Change cover{' '}
          </button>{' '}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />{' '}
          <div className="absolute -bottom-10 left-6 flex items-end gap-3">
            {' '}
            <div className="relative">
              {' '}
              <Avatar className="h-20 w-20 border-4 border-card shadow-lg">
                {' '}
                <AvatarImage src={avatarPreview || undefined} />{' '}
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-bold text-white">
                  {user?.name?.charAt(0) || '?'}
                </AvatarFallback>{' '}
              </Avatar>{' '}
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-card hover:bg-primary/90 transition"
                disabled={uploading}
              >
                {' '}
                <Camera className="h-3.5 w-3.5" />{' '}
              </button>{' '}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        <div className="px-6 pb-6 pt-12">
          {' '}
          <h3 className="font-semibold">{user?.name || 'Your Name'}</h3>{' '}
          <p className="text-sm text-muted-foreground">
            {user?.headline || 'Add a headline to stand out'}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {/* Profile Info */}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <FileText className="h-3.5 w-3.5" />
            </span>{' '}
            Profile Information
          </h2>{' '}
          <p className="mt-1 text-xs text-muted-foreground">
            This information will appear on your public profile.
          </p>{' '}
        </div>{' '}
        <div className="p-6">
          {' '}
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {' '}
            <div className="grid gap-5 sm:grid-cols-2">
              {' '}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Display Name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 rounded-xl bg-muted/20"
                />
              </div>{' '}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="h-10 rounded-xl bg-muted/20 pl-7"
                  />
                </div>
              </div>{' '}
            </div>{' '}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Headline
              </label>
              <Input
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="e.g. CNC Machinist | Manufacturing Engineer"
                className="h-10 rounded-xl bg-muted/20"
              />
            </div>{' '}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                className="flex w-full rounded-xl border border-input bg-muted/20 px-3 py-2 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                placeholder="Tell us about yourself..."
              />
            </div>{' '}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Location
              </label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Detroit, MI"
                className="h-10 rounded-xl bg-muted/20"
              />
            </div>{' '}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving || uploading}
                className="h-9 rounded-full px-6 shadow-md"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>{' '}
          </form>{' '}
        </div>{' '}
      </div>{' '}
      {/* Portfolio */}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <div>
            {' '}
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
                <Briefcase className="h-3.5 w-3.5" />
              </span>{' '}
              Portfolio
            </h2>{' '}
            <p className="mt-1 text-xs text-muted-foreground">
              Showcase your projects and work.
            </p>{' '}
          </div>{' '}
          <Button
            size="sm"
            onClick={() => {
              setPfForm({ title: '', description: '', projectUrl: '', image: '', tags: '' });
              setEditingPortfolioId(null);
              setShowPortfolioForm(true);
            }}
            className="h-8 rounded-full gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>{' '}
        </div>{' '}
        <div className="p-6 space-y-4">
          {' '}
          {showPortfolioForm && (
            <form
              onSubmit={handlePortfolioSubmit}
              className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4"
            >
              {' '}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Title *
                </label>
                <Input
                  value={pfForm.title}
                  onChange={(e) => setPfForm({ ...pfForm, title: e.target.value })}
                  required
                  className="h-10 rounded-xl bg-card"
                />
              </div>{' '}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={pfForm.description}
                  onChange={(e) => setPfForm({ ...pfForm, description: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                />
              </div>{' '}
              <div className="grid gap-4 sm:grid-cols-2">
                {' '}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Project URL
                  </label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={pfForm.projectUrl}
                      onChange={(e) => setPfForm({ ...pfForm, projectUrl: e.target.value })}
                      placeholder="https://..."
                      className="h-10 rounded-xl bg-card pl-8"
                    />
                  </div>
                </div>{' '}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tags
                  </label>
                  <Input
                    value={pfForm.tags}
                    onChange={(e) => setPfForm({ ...pfForm, tags: e.target.value })}
                    placeholder="CNC, CAD"
                    className="h-10 rounded-xl bg-card"
                  />
                </div>{' '}
              </div>{' '}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Image
                </label>
                {pfForm.image ? (
                  <div className="relative inline-block">
                    <img
                      src={pfForm.image}
                      alt="Preview"
                      className="h-24 w-36 rounded-xl object-cover border shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPfForm({ ...pfForm, image: '' })}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-muted/20 hover:bg-muted/40 transition">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePortfolioImage}
                    />
                  </label>
                )}
              </div>{' '}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={pfSaving || !pfForm.title.trim()}
                  className="rounded-full"
                >
                  {pfSaving ? 'Saving...' : editingPortfolioId ? 'Update' : 'Add Project'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPfForm({ title: '', description: '', projectUrl: '', image: '', tags: '' });
                    setEditingPortfolioId(null);
                    setShowPortfolioForm(false);
                  }}
                  className="rounded-full"
                >
                  Cancel
                </Button>
              </div>{' '}
            </form>
          )}{' '}
          {portfolioLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading portfolio...</p>
          ) : portfolio.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed bg-muted/10 px-8 py-12 text-center">
              {' '}
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>{' '}
              <p className="mt-3 text-sm font-medium">No portfolio items yet</p>{' '}
              <p className="text-xs text-muted-foreground">
                Add a project to showcase your work.
              </p>{' '}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {' '}
              {portfolio.map((item, idx) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/20"
                >
                  {' '}
                  <div className="flex items-start justify-between gap-2">
                    {' '}
                    <h3 className="pr-2 text-sm font-semibold leading-tight">{item.title}</h3>{' '}
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      {' '}
                      <button
                        type="button"
                        onClick={() => handleMovePortfolio(item.id, 'up')}
                        disabled={idx === 0}
                        className="rounded-lg p-1 hover:bg-muted disabled:opacity-30"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>{' '}
                      <button
                        onClick={() => handleEditPortfolio(item)}
                        className="rounded-lg p-1 hover:bg-muted"
                      >
                        <span className="text-xs">✎</span>
                      </button>{' '}
                      <button
                        onClick={() => handleDeletePortfolio(item.id)}
                        className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>{' '}
                    </div>{' '}
                  </div>{' '}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="mt-3 h-28 w-full rounded-xl object-cover"
                    />
                  )}{' '}
                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}{' '}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.filter(Boolean).map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}{' '}
                  {item.projectUrl && (
                    <a
                      href={item.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View Project
                    </a>
                  )}{' '}
                </div>
              ))}{' '}
            </div>
          )}{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
