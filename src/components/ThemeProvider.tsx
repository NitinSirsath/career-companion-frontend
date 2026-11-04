import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import {
  parseStoredTheme,
  resolveTheme,
  setWindowBarColor,
  type ResolvedTheme,
  type ThemeChoice,
} from '../lib/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
  /** While true the page shows the light theme; the saved choice stays (the sign-in pages). */
  setLightOnly: (lightOnly: boolean) => void;
}

// Outside a provider (as in tests) the app shows the light theme and ignores changes.
const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
  setLightOnly: () => undefined,
});

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children, storageKey = 'vite-ui-theme' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    parseStoredTheme(localStorage.getItem(storageKey)),
  );
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const resolvedTheme = resolveTheme(theme, prefersDark);
  const [lightOnly, setLightOnly] = useState(false);
  const shown: ResolvedTheme = lightOnly ? 'light' : resolvedTheme;

  // "System" follows the computer while the app is open, not only at start.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setPrefersDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Before the page is painted, so a light-only page never shows a flash of dark.
  useLayoutEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'dark');
    root.classList.add(`theme-${shown}`);
    if (shown === 'dark') root.classList.add('dark');
    root.style.colorScheme = shown === 'dark' ? 'dark' : 'light';
    setWindowBarColor(shown);
  }, [shown]);

  const value = {
    theme,
    resolvedTheme,
    setLightOnly,
    setTheme: (next: ThemeChoice) => {
      localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => useContext(ThemeProviderContext);
