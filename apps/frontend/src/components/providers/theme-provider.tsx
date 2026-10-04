'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_THEME_TOKENS } from '@titan/shared';
import type { ThemeTokens } from '@titan/shared';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { mergeThemeTokens, themeTokensToCss } from '@/lib/builder/theme-css';

export type ColorMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

const MODE_KEY = 'titans:color-mode';
const TOKENS_KEY = 'titans:theme:tokens';
/** Pre-rendered CSS for the same tokens — re-injected after mount so a reload
 *  does not flash the tenant palette before React hydrates. */
const CSS_KEY = 'titans:theme:css';
const STYLE_ID = 'user-theme-tokens';

function readStoredMode(): ColorMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(MODE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  // Cookie is the SSR source of truth — don't clobber a cookie-only preference
  // with 'system' just because localStorage was cleared.
  const m = document.cookie.match(/(?:^|;\s*)titans:color-mode=(light|dark|system)\b/);
  return m ? (m[1] as ColorMode) : 'system';
}

/** Mirror the mode into a cookie so the server can bake it onto <html>. */
function persistModeCookie(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  document.cookie = `${MODE_KEY}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function readStoredTokens(): ThemeTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ThemeTokens>;
    if (!parsed || typeof parsed !== 'object') return null;
    return mergeThemeTokens(DEFAULT_THEME_TOKENS, parsed);
  } catch {
    return null;
  }
}

/** Cache the rendered CSS so it can be re-applied without a network round-trip. */
function persistCss(tokens: ThemeTokens | null) {
  if (typeof window === 'undefined') return;
  try {
    if (tokens) window.localStorage.setItem(CSS_KEY, themeTokensToCss(tokens));
    else window.localStorage.removeItem(CSS_KEY);
  } catch {
    /* storage full or blocked — the in-memory style tag still applies */
  }
}

/**
 * Write the user's token overrides as a stylesheet appended after the
 * server-rendered tenant theme, so identical selectors resolve in its favour.
 * Passing `null` removes it entirely and lets the tenant theme stand.
 */
function applyTokenStyle(tokens: ThemeTokens | null, persist = false) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tokens) {
    el?.remove();
    if (persist) persistCss(null);
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = themeTokensToCss(tokens);
  if (persist) persistCss(tokens);
}

function applyModeClass(mode: ResolvedMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  root.style.colorScheme = mode;
}

interface ThemeContextValue {
  /** The user's choice, which may be 'system'. */
  colorMode: ColorMode;
  /** What is actually on screen. */
  resolvedMode: ResolvedMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  /** The editable token set: tenant base with the user's overrides applied. */
  tokens: ThemeTokens;
  /** True when the user has custom tokens over the tenant base. */
  hasCustomTokens: boolean;
  /** Live-edit tokens without saving — drives the editor's preview. */
  previewTokens: (next: ThemeTokens) => void;
  /** Persist tokens to the account (and locally). */
  saveTokens: (next: ThemeTokens) => Promise<boolean>;
  /** Drop the overrides and inherit the tenant theme again. */
  resetTokens: () => Promise<boolean>;
  /** True once stored preferences have been loaded. */
  hydrated: boolean;
  saving: boolean;
  /** Signed-in users get account-level persistence; others are local-only. */
  persistedToAccount: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorMode: 'system',
  resolvedMode: 'light',
  setColorMode: () => {},
  toggleColorMode: () => {},
  tokens: DEFAULT_THEME_TOKENS,
  hasCustomTokens: false,
  previewTokens: () => {},
  saveTokens: async () => false,
  resetTokens: async () => false,
  hydrated: false,
  saving: false,
  persistedToAccount: false,
});

interface PreferencesPayload {
  theme?: string;
  themeTokens?: ThemeTokens | null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Both start at the SSR-stable value. Reading localStorage/matchMedia in the
  // initialiser makes the client's first render differ from the server's, which
  // is a hydration mismatch — the theme toggle rendered a Moon where the server
  // had rendered a Sun. The pre-paint script already applies the real mode to
  // <html>, so deferring the read costs nothing visually.
  const [colorMode, setColorModeState] = useState<ColorMode>('system');
  const [systemDark, setSystemDark] = useState(false);
  /** Tenant published tokens — the base everything else layers onto. */
  const [baseTokens, setBaseTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  /** The user's own overrides; null means "inherit the tenant theme". */
  const [userTokens, setUserTokens] = useState<ThemeTokens | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persistedToAccount, setPersistedToAccount] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const resolvedMode: ResolvedMode =
    colorMode === 'system' ? (systemDark ? 'dark' : 'light') : colorMode;

  /** What the editor edits and the previews render. */
  const tokens = useMemo(
    () => (userTokens ? mergeThemeTokens(baseTokens, userTokens) : baseTokens),
    [baseTokens, userTokens],
  );

  // Apply the stored preference once mounted, then track OS changes.
  useEffect(() => {
    const stored = readStoredMode();
    setColorModeState(stored);
    // Only mirror an explicit choice; a missing localStorage+cookie stays 'system'
    // without rewriting the cookie on every load.
    if (stored !== 'system' || window.localStorage.getItem(MODE_KEY) || document.cookie.includes(`${MODE_KEY}=`)) {
      persistModeCookie(stored);
    }
    setSystemDark(systemPrefersDark());
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply stored overrides immediately, before any network round-trip, so there
  // is no flash back to the tenant palette.
  useEffect(() => {
    const stored = readStoredTokens();
    if (stored) setUserTokens(stored);
    setHydrated(true);
  }, []);

  // Tenant published theme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ tokens?: ThemeTokens }>('/content/themes/current');
        if (!cancelled && res?.tokens) setBaseTokens(res.tokens);
      } catch {
        /* keep the built-in defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Account-level preferences, when signed in.
  useEffect(() => {
    if (!isAuthenticated) {
      setPersistedToAccount(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const prefs = await api.get<PreferencesPayload>('/auth/me/preferences');
        if (cancelled || !prefs) return;
        if (prefs.themeTokens) {
          setUserTokens(mergeThemeTokens(DEFAULT_THEME_TOKENS, prefs.themeTokens));
          window.localStorage.setItem(TOKENS_KEY, JSON.stringify(prefs.themeTokens));
        }
        if (prefs.theme === 'light' || prefs.theme === 'dark' || prefs.theme === 'system') {
          setColorModeState(prefs.theme);
          window.localStorage.setItem(MODE_KEY, prefs.theme);
          persistModeCookie(prefs.theme);
        }
        if (!cancelled) setPersistedToAccount(true);
      } catch {
        if (!cancelled) setPersistedToAccount(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    applyModeClass(resolvedMode);
  }, [resolvedMode]);

  // Only overrides are written out. With none, the server-rendered tenant theme
  // (already in <head>) is left alone instead of being clobbered by defaults.
  useEffect(() => {
    applyTokenStyle(userTokens);
  }, [userTokens]);

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      setColorModeState(mode);
      window.localStorage.setItem(MODE_KEY, mode);
      persistModeCookie(mode);
      if (isAuthenticated) {
        // Fire-and-forget: a failed preference write must not block the UI.
        void api.put('/auth/me/preferences', { theme: mode }).catch(() => {});
      }
    },
    [isAuthenticated],
  );

  const toggleColorMode = useCallback(() => {
    setColorMode(resolvedMode === 'dark' ? 'light' : 'dark');
  }, [resolvedMode, setColorMode]);

  const previewTokens = useCallback((next: ThemeTokens) => {
    setUserTokens(next);
  }, []);

  const saveTokens = useCallback(
    async (next: ThemeTokens) => {
      setSaving(true);
      // Optimistic: apply and cache locally first, so the change survives a reload
      // even if the account write fails.
      setUserTokens(next);
      window.localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
      applyTokenStyle(next, true);
      try {
        if (isAuthenticated) {
          await api.put('/auth/me/preferences', { themeTokens: next });
          setPersistedToAccount(true);
        }
        return true;
      } catch {
        setPersistedToAccount(false);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [isAuthenticated],
  );

  const resetTokens = useCallback(async () => {
    setSaving(true);
    try {
      setUserTokens(null);
      window.localStorage.removeItem(TOKENS_KEY);
      applyTokenStyle(null, true);
      if (isAuthenticated) {
        await api.put('/auth/me/preferences', { themeTokens: null });
      }
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorMode,
      resolvedMode,
      setColorMode,
      toggleColorMode,
      tokens,
      hasCustomTokens: userTokens !== null,
      previewTokens,
      saveTokens,
      resetTokens,
      hydrated,
      saving,
      persistedToAccount,
    }),
    [
      colorMode,
      resolvedMode,
      setColorMode,
      toggleColorMode,
      tokens,
      userTokens,
      previewTokens,
      saveTokens,
      resetTokens,
      hydrated,
      saving,
      persistedToAccount,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
