'use client';
import { useEffect, useState, type ComponentType } from 'react';

export default function BuilderPage() {
  const [Editor, setEditor] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('./builder-editor').then((m) => {
      if (!cancelled) setEditor(() => m.BuilderEditor);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Editor) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading builder…
      </div>
    );
  }

  return <Editor />;
}
