'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@titan/shared';

interface CurrencyState {
  /** Currency every storefront price is displayed and filtered in. */
  code: CurrencyCode;
  setCode: (code: string) => void;
}

/**
 * Display currency for the storefront. SAR is the workspace's primary currency,
 * so it is the default; the choice is persisted per browser.
 */
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      code: DEFAULT_CURRENCY,
      setCode: (code) => {
        if (isCurrencyCode(code)) set({ code });
      },
    }),
    { name: 'currency-preference' },
  ),
);
