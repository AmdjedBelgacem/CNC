'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Users, MessageSquare, UserPlus, Check, Shield, Lock } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
export default function PrivacyPage() {
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [messages, setMessages] = useState<'everyone' | 'followers' | 'none'>('everyone');
  const [follows, setFollows] = useState<'everyone' | 'approval'>('everyone');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const res = await apiProxyFetch('/api/proxy/auth/me/preferences');
        if (res.ok) {
          const data = await res.json();
          // Column names on user_preferences: profile_visibility / who_can_message / who_can_follow.
          if (data?.profileVisibility) setVisibility(data.profileVisibility);
          if (data?.whoCanMessage) setMessages(data.whoCanMessage);
          if (data?.whoCanFollow) setFollows(data.whoCanFollow);
        }
      } catch {}
    })();
  }, []);
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiProxyFetch('/api/proxy/auth/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileVisibility: visibility,
          whoCanMessage: messages,
          whoCanFollow: follows,
        }),
      });
      // The endpoint returns 200 with the full row, so a "success" that did not
      // actually apply the values is impossible to spot without re-reading it.
      const saved_ = res.ok ? await res.json().catch(() => null) : null;
      if (!saved_) throw new Error('Privacy settings could not be saved');
      if (
        saved_.profileVisibility !== visibility ||
        saved_.whoCanMessage !== messages ||
        saved_.whoCanFollow !== follows
      ) {
        throw new Error('Privacy settings were not applied. Please try again.');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Privacy settings could not be saved');
    } finally {
      setSaving(false);
    }
  };
  const Card = ({ active, onClick, icon: Icon, title, desc }: any) => (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/20 hover:bg-muted/20'}`}
    >
      {' '}
      {active && (
        <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" />
        </span>
      )}{' '}
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
      >
        {' '}
        <Icon className="size-5" />{' '}
      </span>{' '}
      <span className="text-sm font-semibold">{title}</span>{' '}
      <span className="text-xs leading-relaxed text-muted-foreground">{desc}</span>{' '}
    </button>
  );
  return (
    <div className="space-y-6">
      {' '}
      <div className="flex gap-4">
        {' '}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {' '}
          <Eye className="size-5" />{' '}
        </div>{' '}
        <div>
          {' '}
          <h1 className="text-xl font-semibold tracking-tight">Privacy</h1>{' '}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Control who can see and interact with you.
          </p>{' '}
        </div>{' '}
      </div>{' '}
      {saved && (
        <div className="flex gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success">
          <Check className="size-4 shrink-0 mt-0.5" /> Privacy settings saved.
        </div>
      )}{' '}
      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <Shield className="size-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Eye className="size-3.5" />
            </span>{' '}
            Profile Visibility
          </h2>{' '}
        </div>{' '}
        <div className="grid gap-3 p-6 sm:grid-cols-3">
          {' '}
          <Card
            active={visibility === 'public'}
            onClick={() => setVisibility('public')}
            icon={Users}
            title="Public"
            desc="Anyone can view your profile"
          />{' '}
          <Card
            active={visibility === 'followers'}
            onClick={() => setVisibility('followers')}
            icon={Shield}
            title="Followers"
            desc="Only followers can view"
          />{' '}
          <Card
            active={visibility === 'private'}
            onClick={() => setVisibility('private')}
            icon={Lock}
            title="Private"
            desc="Only you can view"
          />{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <MessageSquare className="size-3.5" />
            </span>{' '}
            Who Can Message You
          </h2>{' '}
        </div>{' '}
        <div className="grid gap-3 p-6 sm:grid-cols-3">
          {' '}
          <Card
            active={messages === 'everyone'}
            onClick={() => setMessages('everyone')}
            icon={MessageSquare}
            title="Everyone"
            desc="Open inbox"
          />{' '}
          <Card
            active={messages === 'followers'}
            onClick={() => setMessages('followers')}
            icon={Users}
            title="Followers"
            desc="Followers only"
          />{' '}
          <Card
            active={messages === 'none'}
            onClick={() => setMessages('none')}
            icon={Eye}
            title="No one"
            desc="Closed inbox"
          />{' '}
        </div>{' '}
      </div>{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <UserPlus className="size-3.5" />
            </span>{' '}
            Who Can Follow You
          </h2>{' '}
        </div>{' '}
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {' '}
          <Card
            active={follows === 'everyone'}
            onClick={() => setFollows('everyone')}
            icon={Users}
            title="Everyone"
            desc="Instant follow, no approval"
          />{' '}
          <Card
            active={follows === 'approval'}
            onClick={() => setFollows('approval')}
            icon={Shield}
            title="Approval"
            desc="Requests need your OK"
          />{' '}
        </div>{' '}
      </div>{' '}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        {' '}
        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-6 shadow-md">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Preferences'}
        </Button>{' '}
      </div>{' '}
    </div>
  );
}
