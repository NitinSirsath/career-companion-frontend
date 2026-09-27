import { useTheme, Theme } from './ThemeProvider';
import { cn } from '../lib/utils';
import { Monitor } from 'lucide-react';

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  
  const themes: { id: Theme; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'grey', label: 'Grey' },
    { id: 'github', label: 'GitHub' },
    { id: 'monokai', label: 'Monokai' },
  ];

  return (
    <div className={cn("flex flex-col gap-2 px-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Monitor className="w-4 h-4" />
        <label htmlFor="theme-select">Theme</label>
      </div>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className="h-9 w-full rounded-none border border-border-default bg-surface px-3 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
