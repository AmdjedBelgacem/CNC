'use client';
import dynamic from 'next/dynamic';
const ThemeEditor = dynamic(() => import('./theme-editor').then((m) => m.ThemeEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Loading theme editor…
    </div>
  ),
});
export default function ThemePage() {
  return <ThemeEditor />;
}
