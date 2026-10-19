import { useTheme } from './ThemeProvider';
import { THEME_CHOICES } from '../lib/theme';
import { Select } from './ui/select';

/** System, Light or Dark. "System" follows the computer's setting. */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <Select
      label="Theme"
      options={THEME_CHOICES}
      value={theme}
      onValueChange={setTheme}
      className={className}
    />
  );
}
