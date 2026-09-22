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
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
        <Monitor className="w-4 h-4" />
        <span>Theme</span>
      </div>
      <div className="flex flex-col gap-1 px-2">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "text-left px-3 py-2 text-sm transition-colors rounded-none outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              theme === t.id
                ? "bg-surface-selected text-text-primary font-semibold border-l-2 border-border-focus"
                : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary border-l-2 border-transparent"
            )}
            aria-label={`Select ${t.label} theme`}
            aria-pressed={theme === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
