/** Six soft colours for other people's initials (owner, 3 Nov 2026). */
const TONES = [
  'bg-[var(--avatar-1)] text-[var(--avatar-1-text)]',
  'bg-[var(--avatar-2)] text-[var(--avatar-2-text)]',
  'bg-[var(--avatar-3)] text-[var(--avatar-3-text)]',
  'bg-[var(--avatar-4)] text-[var(--avatar-4-text)]',
  'bg-[var(--avatar-5)] text-[var(--avatar-5-text)]',
  'bg-[var(--avatar-6)] text-[var(--avatar-6-text)]',
] as const;

/** The same name always gets the same colour, whatever its case or spacing. */
export function avatarTone(name: string): (typeof TONES)[number] {
  let sum = 0;
  for (const char of name.trim().toLowerCase().replace(/\s+/g, ' ')) sum += char.charCodeAt(0);
  return TONES[sum % TONES.length];
}
