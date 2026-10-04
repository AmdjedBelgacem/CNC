'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { BuilderLoadFailed, BuilderSkeleton } from '@/components/builder/builder-shell';

/**
 * The builder route.
 *
 * The editor is a large dynamic import: Puck plus the block registry is far too
 * heavy for the admin bundle, and code-splitting it keeps `/admin` cheap. The
 * cost is a loading state, so that state is a skeleton shaped like the editor it
 * is standing in for — not a line of grey text.
 */
export default function BuilderPage() {
  const [Editor, setEditor] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('./builder-editor')
      .then((module) => {
        if (!cancelled) setEditor(() => module.BuilderEditor);
      })
      .catch(() => {
        // A chunk that will not load otherwise leaves a blank page with no
        // explanation and no way forward.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <BuilderLoadFailed onRetry={() => window.location.reload()} />;
  if (!Editor) return <BuilderSkeleton />;
  return <Editor />;
}
