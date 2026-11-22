import type { InviteSource } from '../contracts/invites';

/** Where someone heard about NorthList, in the order the invite form shows them. */
export const INVITE_SOURCES: readonly { value: InviteSource; label: string }[] = [
  { value: 'FRIEND', label: 'A friend or colleague' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'X', label: 'X' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'SEARCH', label: 'Google search' },
  { value: 'OTHER', label: 'Other' },
];

/** The words for a source on the Admin page; Other shows the person's own words. */
export function inviteSourceLabel(source: InviteSource, otherSource: string | null): string {
  if (source === 'OTHER') return otherSource ? `Other: ${otherSource}` : 'Other';
  return INVITE_SOURCES.find((option) => option.value === source)?.label ?? source;
}
