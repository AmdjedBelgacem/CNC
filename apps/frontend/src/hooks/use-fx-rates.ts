'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_CURRENCY } from '@titan/shared';
import type { FxRates } from '@/lib/api/types';

const TTL_MS = 15 * 60 * 1000;

interface FxState {
  data: FxRates | null;
  loading: boolean;
  error: string | null;
}

let state: FxState = { data: null, loading: false, error: null };
let fetchedAt = 0;
let inflight: Promise<FxRates> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<FxState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

function ensure(force = false): Promise<FxRates> {
  if (!force && state.data && Date.now() - fetchedAt < TTL_MS) return Promise.resolve(state.data);
  if (inflight) return inflight;

  setState({ loading: true, error: null });
  inflight = fetch(`/api/proxy/currencies?base=${DEFAULT_CURRENCY}`, { headers: { accept: 'application/json' } })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<FxRates>;
    })
    .then((data) => {
      fetchedAt = Date.now();
      setState({ data, loading: false, error: null });
      return data;
    })
    .catch((err: unknown) => {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Request failed' });
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  // Callers that only need "loaded once" should not see an unhandled rejection.
  return inflight.catch(() => state.data as FxRates);
}

/**
 * Live exchange rates quoted against SAR, shared across every storefront
 * component through a module-level cache so one page triggers one request.
 */
export function useFxRates() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!state.data) void ensure().catch(() => undefined);
  }, []);

  const refresh = useCallback(() => {
    void ensure(true).catch(() => undefined);
  }, []);

  return {
    rates: snapshot.data?.rates ?? null,
    source: snapshot.data?.source ?? null,
    updatedAt: snapshot.data?.updatedAt ?? null,
    stale: snapshot.data?.stale ?? true,
    loading: snapshot.loading,
    error: snapshot.error,
    refresh,
  };
}
