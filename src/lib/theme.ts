/**
 * What the user picks. "system" follows the computer's light or dark setting. Light is one flat
 * white, Dark one flat near-black; lines, not shades, split the page.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** What the page actually shows. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The stored choice, or "system" when nothing usable is stored. Themes the app no longer offers
 * (white, grey, github, monokai) fall back to "system" too.
 */
export function parseStoredTheme(stored: string | null): ThemeChoice {
  return THEME_CHOICES.some((t) => t.value === stored) ? (stored as ThemeChoice) : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}
