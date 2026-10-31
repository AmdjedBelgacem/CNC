'use client';
import { WifiOff, RefreshCw, BookOpen, Layers, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/motion';
export default function OfflinePage() {
  const t = useTranslations('offline');
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) window.location.reload();
    };
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);
  const tiles = [
    {
      icon: BookOpen,
      tone: 'bg-primary/[0.08] text-primary ring-primary/10',
      title: t('browseLaterTitle'),
      hint: t('browseLaterHint'),
    },
    {
      icon: Layers,
      tone: 'bg-muted text-foreground ring-border/70',
      title: t('cachedAssetsTitle'),
      hint: t('cachedAssetsHint'),
    },
    {
      icon: Sparkles,
      tone: 'bg-accent/10 text-accent ring-accent/15',
      title: t('liveActionsTitle'),
      hint: t('liveActionsHint'),
    },
  ];
  return (
    <div className="relative mx-auto flex min-h-[64vh] max-w-2xl flex-col items-center px-4 py-20 text-center md:py-24">
      <Reveal className="flex flex-col items-center">
        <div className="relative flex size-16 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border/70">
          {/* A slow ripple while we wait for the network — stops once back online. */}
          <AnimatePresence>
            {!online && (
              <m.span
                key="ripple"
                aria-hidden
                className="absolute inset-0 rounded-full ring-1 ring-primary/30"
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
          <WifiOff className="size-7 text-muted-foreground" />
        </div>
        <h1 className="mt-7 text-balance font-display text-3xl font-medium tracking-[-0.022em] sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {t('description')}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={() => window.location.reload()}
            className="pressable group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-4 transition-transform duration-500 group-hover:rotate-180" />{' '}
            {online ? t('reload') : t('retryWhenOnline')}
          </button>
          <a
            href="/"
            className="pressable inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium shadow-xs transition-colors hover:border-border-strong hover:bg-muted/50"
          >
            {t('goHome')}
          </a>
        </div>
      </Reveal>
      <Stagger className="mt-14 grid w-full gap-4 text-start sm:grid-cols-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <StaggerItem
              key={tile.title}
              index={i}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs"
            >
              <div
                className={`flex size-9 items-center justify-center rounded-xl ring-1 ring-inset ${tile.tone}`}
              >
                <Icon className="size-4" />
              </div>
              <p className="mt-4 font-display text-base font-medium">{tile.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{tile.hint}</p>
            </StaggerItem>
          );
        })}
      </Stagger>
      <Reveal
        delay={0.1}
        className="mt-6 w-full overflow-hidden rounded-2xl border border-border/70 shadow-xs"
      >
        <div className="grid grid-cols-2 text-start text-xs">
          <div className="bg-card p-4">
            <p className="flex items-center gap-2 font-medium">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              {t('worksOfflineTitle')}
            </p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">{t('worksOfflineHint')}</p>
          </div>
          <div className="border-s border-border/70 bg-muted/40 p-4">
            <p className="flex items-center gap-2 font-medium">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              {t('needsOnlineTitle')}
            </p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">{t('needsOnlineHint')}</p>
          </div>
        </div>
      </Reveal>
      <p className="mt-8 text-xs text-muted-foreground">{t('autoReloadHint')}</p>
    </div>
  );
}
