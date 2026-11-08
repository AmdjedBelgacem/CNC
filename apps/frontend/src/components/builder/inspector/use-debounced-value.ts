'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Debounces commits for text-like inputs so typing stays smooth (no store dispatch per keystroke,
 * stable cursor). Local state drives the input; the value is committed after a 150ms pause or on
 * blur. External changes (undo/redo/page switch) are picked up via lastCommitted comparison.
 */
export function useDebouncedValue<T>(value: T, commit: (next: T) => void, delay = 150) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const lastCommitted = useRef(value);
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setLocal(value);
    }
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        commitRef.current(lastCommitted.current);
      }
    },
    [],
  );
  const update = (next: T) => {
    lastCommitted.current = next;
    setLocal(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(next);
    }, delay);
  };
  const flush = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
      commitRef.current(lastCommitted.current);
    }
  };
  return { local, update, flush };
}
