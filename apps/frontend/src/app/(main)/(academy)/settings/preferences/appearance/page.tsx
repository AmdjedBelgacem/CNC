'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Palette, Sun, Moon, Monitor, Check, Paintbrush, LayoutGrid } from 'lucide-react';
import { apiProxyFetch } from '@/hooks/use-api-proxy';
import { m } from 'framer-motion';
import { Crossfade, Stagger, StaggerItem } from '@/components/ui/motion';
import { spring } from '@/lib/motion';
import {
  ChoiceTile,
  SettingsBanner,
  SettingsHeader,
  SettingsSaveBar,
  SettingsSection,
} from '../../_components/settings-ui';
export default function AppearancePage() {
  const t = useTranslations('account');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const res = await apiProxyFetch('/api/proxy/auth/me/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data?.theme) setTheme(data.theme);
          if (data?.density) setDensity(data.density);
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
        body: JSON.stringify({ theme, density }),
      });
      // This used to ignore res.ok entirely and swallow every error, so a 400/403/500
      // still rendered "Saved".
      const applied = res.ok ? await res.json().catch(() => null) : null;
      if (!applied) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          typeof detail?.message === 'string' ? detail.message : t('appearance.saveFailed'),
        );
      }
      if (applied.theme !== theme || applied.density !== density) {
        throw new Error(
          t('appearance.notApplied', { default: 'Appearance settings were not applied.' }),
        );
      }
      setSaved(true);
      toast({ type: 'ok', title: t('appearance.savedToast') });
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      const message = e instanceof Error ? e.message : t('appearance.saveFailed');
      setError(message);
      toast({ type: 'err', title: t('appearance.saveFailed'), description: message });
    } finally {
      setSaving(false);
    }
  };
  const themeOptions = [
    {
      id: 'system',
      label: t('appearance.themeSystem'),
      desc: t('appearance.themeSystemDesc'),
      icon: Monitor,
    },
    {
      id: 'light',
      label: t('appearance.themeLight'),
      desc: t('appearance.themeLightDesc'),
      icon: Sun,
    },
    {
      id: 'dark',
      label: t('appearance.themeDark'),
      desc: t('appearance.themeDarkDesc'),
      icon: Moon,
    },
  ] as const;
  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={Palette}
        title={t('appearance.pageTitle')}
        subtitle={t('appearance.pageSubtitle')}
      />
      <SettingsBanner show={saved} tone="success" icon={Check} role="status">
        {t('appearance.savedToast')}
      </SettingsBanner>
      <SettingsBanner show={!!error} tone="error" icon={Paintbrush} role="alert">
        {error}
      </SettingsBanner>
      <SettingsSection
        icon={Paintbrush}
        title={t('appearance.themeTitle')}
        description={t('appearance.themeDesc')}
      >
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {themeOptions.map((opt, index) => {
            const active = theme === opt.id;
            return (
              <StaggerItem key={opt.id} index={index}>
                <ChoiceTile
                  active={active}
                  onSelect={() => setTheme(opt.id)}
                  layoutId="appearance-theme-active"
                  className="w-full p-2.5"
                >
                  <ThemePreview mode={opt.id} />
                  <span className="mt-3 flex items-center gap-2.5 px-1 pb-0.5">
                    <opt.icon
                      className={`size-4 shrink-0 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                    </span>
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong'}`}
                    >
                      {active && (
                        <m.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
                          className="flex"
                        >
                          <Check className="size-3" />
                        </m.span>
                      )}
                    </span>
                  </span>
                </ChoiceTile>
              </StaggerItem>
            );
          })}
        </Stagger>
      </SettingsSection>
      <SettingsSection
        icon={LayoutGrid}
        title={t('appearance.densityTitle')}
        description={t('appearance.densityDesc')}
        delay={0.05}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              id: 'comfortable',
              label: t('appearance.densityComfortable'),
              desc: t('appearance.densityComfortableDesc'),
              pad: 'p-4',
              gap: 'mt-2.5',
            },
            {
              id: 'compact',
              label: t('appearance.densityCompact'),
              desc: t('appearance.densityCompactDesc'),
              pad: 'p-2',
              gap: 'mt-1.5',
            },
          ].map((opt) => {
            const active = density === opt.id;
            return (
              <ChoiceTile
                key={opt.id}
                active={active}
                onSelect={() => setDensity(opt.id as 'comfortable' | 'compact')}
                layoutId="appearance-density-active"
                className="p-4"
              >
                <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                <span
                  className={`mt-3 block rounded-lg border border-border/70 bg-background ${opt.pad}`}
                >
                  {[0, 1, 2].map((row) => (
                    <span key={row} className={`flex items-center gap-2 ${row ? opt.gap : ''}`}>
                      <span
                        className={`size-2 rounded-full ${active && row === 0 ? 'bg-primary' : 'bg-border-strong'}`}
                      />
                      <span
                        className="block h-1.5 rounded-full bg-muted"
                        style={{ width: `${70 - row * 15}%` }}
                      />
                    </span>
                  ))}
                </span>
              </ChoiceTile>
            );
          })}
        </div>
      </SettingsSection>
      <SettingsSaveBar>
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          <Crossfade value={saving ? 'saving' : saved ? 'saved' : 'idle'} axis="none">
            {saving ? t('saving') : saved ? t('savedOk') : t('saveChanges')}
          </Crossfade>
        </Button>
      </SettingsSaveBar>
    </div>
  );
}

/**
 * A miniature window rendered in the theme it represents. The palette here is
 * illustrative (it has to show light while the page is dark and vice versa), so
 * it uses neutral stone steps rather than the live, theme-switching tokens.
 */
function ThemePreview({ mode }: { mode: 'system' | 'light' | 'dark' }) {
  const pane = (tone: 'light' | 'dark') => (
    <span
      className={`flex h-full w-full flex-col gap-1.5 p-2.5 ${tone === 'dark' ? 'bg-stone-900' : 'bg-stone-50'}`}
    >
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className={`size-1.5 rounded-full ${tone === 'dark' ? 'bg-stone-700' : 'bg-stone-300'}`}
          />
        ))}
      </span>
      <span
        className={`mt-1 block h-2 w-3/5 rounded-full ${tone === 'dark' ? 'bg-stone-600' : 'bg-stone-300'}`}
      />
      <span
        className={`flex-1 rounded-md border p-1.5 ${tone === 'dark' ? 'border-stone-700 bg-stone-800' : 'border-stone-200 bg-white'}`}
      >
        <span
          className={`block h-1.5 w-4/5 rounded-full ${tone === 'dark' ? 'bg-stone-600' : 'bg-stone-200'}`}
        />
        <span
          className={`mt-1 block h-1.5 w-1/2 rounded-full ${tone === 'dark' ? 'bg-stone-600' : 'bg-stone-200'}`}
        />
        <span className="mt-2 block h-2 w-8 rounded-full bg-primary" />
      </span>
    </span>
  );
  return (
    <span
      className="relative block h-28 overflow-hidden rounded-lg border border-border/70"
      aria-hidden
    >
      {mode === 'system' ? (
        <>
          <span className="absolute inset-0">{pane('light')}</span>
          <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
            {pane('dark')}
          </span>
        </>
      ) : (
        pane(mode)
      )}
    </span>
  );
}
