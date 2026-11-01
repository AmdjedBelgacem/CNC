'use client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function EditorFallback() {
  const t = useTranslations('theme');
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      {t('loadingEditor')}
    </div>
  );
}

const ThemeEditor = dynamic(() => import('./theme-editor').then((m) => m.ThemeEditor), {
  ssr: false,
  loading: () => <EditorFallback />,
});
export default function ThemePage() {
  return <ThemeEditor />;
}
