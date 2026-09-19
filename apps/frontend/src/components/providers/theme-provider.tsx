'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTenantStore } from '@/stores/tenant-store';
type ColorMode = 'dark' | 'light';
interface ThemeConfig {
  primaryColor: string;
  colorMode: ColorMode;
  toggleColorMode: () => void;
}
const ThemeContext = createContext<ThemeConfig>({
  primaryColor: '#7c3aed',
  colorMode: 'light',
  toggleColorMode: () => {},
});
function getInitialMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('titans-color-mode');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tenant, loaded, load } = useTenantStore();
  const [colorMode, setColorMode] = useState<ColorMode>(getInitialMode);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);
  useEffect(() => {
    const root = document.documentElement;
    if (colorMode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('titans-color-mode', colorMode);
  }, [colorMode]);
  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);
  const config: ThemeConfig = {
    primaryColor: tenant?.primaryColor || '#7c3aed',
    colorMode,
    toggleColorMode,
  };
  return <ThemeContext.Provider value={config}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
