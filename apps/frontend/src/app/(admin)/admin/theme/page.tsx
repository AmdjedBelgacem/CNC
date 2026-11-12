'use client';
import dynamic from 'next/dynamic';
import { ThemeEditorSkeleton } from '@/components/skeletons/admin-route-skeletons';

// While the editor chunk loads, show the editor's own shape rather than a
// centred "Loading editor…" line in an h-screen box that the page then replaces.
const ThemeEditor = dynamic(() => import('./theme-editor').then((m) => m.ThemeEditor), {
  ssr: false,
  loading: () => <ThemeEditorSkeleton />,
});
export default function ThemePage() {
  return <ThemeEditor />;
}
