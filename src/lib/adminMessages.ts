import type { AdminSentMessage } from '../contracts/messages';
import { count, whenLabel } from './admin';

// Admin messages' words (owner, 18 Nov 2026, approved mock `OWNER-MESSAGES-mock/`).

export const EVERYONE = 'EVERYONE';
export const devicesWord = (n: number) => `${count(n)} ${n === 1 ? 'device' : 'devices'}`;

/** "Today, 4:12 PM · To everyone · Alert sent to 12 devices". */
export function sentLine(message: AdminSentMessage) {
  const parts = [whenLabel(message.sentAt), `To ${message.toEmail ?? 'everyone'}`];
  if (message.alertsSent !== null) parts.push(`Alert sent to ${devicesWord(message.alertsSent)}`);
  return parts.join(' · ');
}
