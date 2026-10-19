/**
 * What the user picks. "system" follows the computer's light or dark setting. Light is IBM Carbon
 * "Gray 10" (grey page, white cards), White is Carbon "White" (white page, grey cards), Dark is
 * Carbon "Gray 100".
 */
export type ThemeChoice = 'system' | 'light' | 'white' | 'dark';

/** What the page actually shows. */
export type ResolvedTheme = 'light' | 'white' | 'dark';

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'white', label: 'White' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The stored choice, or "system" when nothing usable is stored. Themes the app no longer offers
 * (grey, github, monokai) fall back to "system" too.
 */
export function parseStoredTheme(stored: string | null): ThemeChoice {
  return THEME_CHOICES.some((t) => t.value === stored) ? (stored as ThemeChoice) : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}
