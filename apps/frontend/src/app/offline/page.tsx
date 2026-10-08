'use client';
import { WifiOff, RefreshCw, BookOpen, Layers, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  return (
    <div className="mx-auto flex min-h-[64vh] max-w-2xl flex-col items-center px-4 py-12 text-center">
      {' '}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
        {' '}
        <WifiOff className="size-8 text-muted-foreground" />{' '}
      </div>{' '}
      <h1 className="mt-5 text-2xl font-bold tracking-tight">{t('title')}</h1>{' '}
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {' '}
        {t('description')}{' '}
      </p>{' '}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {' '}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          {' '}
          <RefreshCw className="size-4" /> {online ? t('reload') : t('retryWhenOnline')}{' '}
        </button>{' '}
        <a
          href="/"
          className="inline-flex items-center rounded-xl border bg-card px-5 py-2.5 text-sm font-medium shadow-sm hover:bg-muted"
        >
          {' '}
          {t('goHome')}{' '}
        </a>{' '}
      </div>{' '}
      <div className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
        {' '}
        <div className="rounded-2xl border bg-card p-4">
          {' '}
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {' '}
            <BookOpen className="size-4" />{' '}
          </div>{' '}
          <p className="mt-3 text-sm font-semibold">{t('browseLaterTitle')}</p>{' '}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('browseLaterHint')}
          </p>{' '}
        </div>{' '}
        <div className="rounded-2xl border bg-card p-4">
          {' '}
          <div className="flex size-8 items-center justify-center rounded-xl bg-secondary/60 text-foreground">
            {' '}
            <Layers className="size-4" />{' '}
          </div>{' '}
          <p className="mt-3 text-sm font-semibold">{t('cachedAssetsTitle')}</p>{' '}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('cachedAssetsHint')}
          </p>{' '}
        </div>{' '}
        <div className="rounded-2xl border bg-card p-4">
          {' '}
          <div className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
            {' '}
            <Sparkles className="size-4" />{' '}
          </div>{' '}
          <p className="mt-3 text-sm font-semibold">{t('liveActionsTitle')}</p>{' '}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t('liveActionsHint')}
          </p>{' '}
        </div>{' '}
      </div>{' '}
      <div className="mt-8 w-full overflow-hidden rounded-2xl border">
        {' '}
        <div className="grid grid-cols-2 text-xs">
          {' '}
          <div className="bg-card p-3">
            {' '}
            <p className="font-semibold">{t('worksOfflineTitle')}</p>{' '}
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {t('worksOfflineHint')}
            </p>{' '}
          </div>{' '}
          <div className="bg-muted/40 p-3">
            {' '}
            <p className="font-semibold">{t('needsOnlineTitle')}</p>{' '}
            <p className="mt-1 leading-relaxed text-muted-foreground">{t('needsOnlineHint')}</p>{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      <p className="mt-6 text-xs text-muted-foreground">
        {t('autoReloadHint')}
      </p>{' '}
    </div>
  );
}
