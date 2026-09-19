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
  useEffect(() => {
    (async () => {
      try {
        const res = await apiProxyFetch('/api/proxy/auth/me/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data?.privacyVisibility) setVisibility(data.privacyVisibility);
          if (data?.privacyMessages) setMessages(data.privacyMessages);
          if (data?.privacyFollows) setFollows(data.privacyFollows);
        }
      } catch {}
    })();
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      await apiProxyFetch('/api/proxy/auth/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyVisibility: visibility,
          privacyMessages: messages,
          privacyFollows: follows,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
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
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}{' '}
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-primary text-white shadow-md' : 'bg-muted text-muted-foreground'}`}
      >
        {' '}
        <Icon className="h-5 w-5" />{' '}
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
          <Eye className="h-5 w-5" />{' '}
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
        <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0 mt-0.5" /> Privacy settings saved.
        </div>
      )}{' '}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {' '}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-4">
          {' '}
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <Eye className="h-3.5 w-3.5" />
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
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <MessageSquare className="h-3.5 w-3.5" />
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
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border">
              <UserPlus className="h-3.5 w-3.5" />
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
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-border bg-white px-4 py-3 shadow-lg">
        {' '}
        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-6 shadow-md">
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Preferences'}
        </Button>{' '}
      </div>{' '}
    </div>
  );
}
