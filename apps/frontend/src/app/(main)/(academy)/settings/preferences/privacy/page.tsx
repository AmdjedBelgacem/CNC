'use client';
import { useState, useEffect, type ElementType } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Eye, Users, MessageSquare, UserPlus, Check, Shield, Lock } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import {
  ChoiceTile,
  SettingsBanner,
  SettingsHeader,
  SettingsSaveBar,
  SettingsSection,
} from '../../_components/settings-ui';
export default function PrivacyPage() {
  const t = useTranslations('account');
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
      if (!saved_) throw new Error(t('privacy.saveFailed'));
      if (
        saved_.profileVisibility !== visibility ||
        saved_.whoCanMessage !== messages ||
        saved_.whoCanFollow !== follows
      ) {
        throw new Error(t('privacy.notApplied', { default: 'Privacy settings were not applied.' }));
      }
      setSaved(true);
      toast({ type: 'ok', title: t('privacy.savedToast') });
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('privacy.saveFailed');
      setError(message);
      toast({ type: 'err', title: t('privacy.saveFailed'), description: message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Eye}
        title={t('privacy.pageTitle')}
        subtitle={t('privacy.pageSubtitle')}
      />
      <SettingsBanner show={saved} tone="success" icon={Check} role="status">
        {t('privacy.savedToast')}
      </SettingsBanner>
      <SettingsBanner show={!!error} tone="error" icon={Shield} role="alert">
        {error}
      </SettingsBanner>
      <SettingsSection icon={Eye} title={t('privacy.visibilityTitle')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card
            group="visibility"
            active={visibility === 'public'}
            onClick={() => setVisibility('public')}
            icon={Users}
            title={t('privacy.visibilityPublic')}
            desc={t('privacy.visibilityPublicDesc')}
          />
          <Card
            group="visibility"
            active={visibility === 'followers'}
            onClick={() => setVisibility('followers')}
            icon={Shield}
            title={t('privacy.visibilityFollowers')}
            desc={t('privacy.visibilityFollowersDesc')}
          />
          <Card
            group="visibility"
            active={visibility === 'private'}
            onClick={() => setVisibility('private')}
            icon={Lock}
            title={t('privacy.visibilityPrivate')}
            desc={t('privacy.visibilityPrivateDesc')}
          />
        </div>
      </SettingsSection>
      <SettingsSection icon={MessageSquare} title={t('privacy.messagesTitle')} delay={0.04}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card
            group="messages"
            active={messages === 'everyone'}
            onClick={() => setMessages('everyone')}
            icon={MessageSquare}
            title={t('privacy.everyone')}
            desc={t('privacy.messagesEveryoneDesc')}
          />
          <Card
            group="messages"
            active={messages === 'followers'}
            onClick={() => setMessages('followers')}
            icon={Users}
            title={t('privacy.visibilityFollowers')}
            desc={t('privacy.messagesFollowersDesc')}
          />
          <Card
            group="messages"
            active={messages === 'none'}
            onClick={() => setMessages('none')}
            icon={Eye}
            title={t('privacy.noOne')}
            desc={t('privacy.messagesNoneDesc')}
          />
        </div>
      </SettingsSection>
      <SettingsSection icon={UserPlus} title={t('privacy.followsTitle')} delay={0.08}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card
            group="follows"
            active={follows === 'everyone'}
            onClick={() => setFollows('everyone')}
            icon={Users}
            title={t('privacy.everyone')}
            desc={t('privacy.followsEveryoneDesc')}
          />
          <Card
            group="follows"
            active={follows === 'approval'}
            onClick={() => setFollows('approval')}
            icon={Shield}
            title={t('privacy.approval')}
            desc={t('privacy.followsApprovalDesc')}
          />
        </div>
      </SettingsSection>
      <SettingsSaveBar>
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t('saving') : saved ? t('savedOk') : t('privacy.savePreferences')}
        </Button>
      </SettingsSaveBar>
    </div>
  );
}

/** One option in a privacy choice group; the ring slides between siblings. */
function Card({
  group,
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  group: string;
  active: boolean;
  onClick: () => void;
  icon: ElementType;
  title: string;
  desc: string;
}) {
  return (
    <ChoiceTile
      active={active}
      onSelect={onClick}
      layoutId={`privacy-${group}-active`}
      className="flex items-start gap-3 p-4"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
      </span>
    </ChoiceTile>
  );
}
