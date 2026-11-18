import type { AdminAccount, AdminOverview } from '../contracts/admin';
import { clock } from './aiLabels';
import { accountCounts, aiLabel, count, dayLabel, KEY_PROBLEM, whenLabel } from './admin';

// The Admin page's words on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screens 13–15).

/** The four numbers in one line: places, Gmail on, new this week, AI calls today. */
export function phoneNumbers(overview: AdminOverview) {
  const counts = accountCounts(overview.accounts);
  const limit = overview.betaUserLimit;
  const callsToday = overview.aiCallsByDay[overview.aiCallsByDay.length - 1]?.calls ?? 0;
  return [
    {
      value: count(counts.real),
      label: limit > 0 ? `of ${count(limit)} places` : 'Accounts',
    },
    { value: count(counts.gmailConnected), label: 'Gmail on' },
    { value: count(counts.newThisWeek), label: 'New this week' },
    { value: count(callsToday), label: 'AI calls today' },
  ];
}

/** An account's name in a row: the name, or the email when there is none. */
export const accountName = (account: AdminAccount) => account.name?.trim() || account.email;

/**
 * The grey line under an account's name: what is wrong first (red when suspended), else its email,
 * else when it signed up.
 */
export function accountNote(account: AdminAccount): { text: string; red: boolean } {
  if (account.suspension) return { text: 'Suspended', red: true };
  if (account.gmail.state === 'SYNC_FAILING') return { text: 'Gmail sync failing', red: true };
  if (account.gmail.state === 'ACCESS_REMOVED') return { text: 'Gmail access removed', red: true };
  if (account.ai.keyProblem) return { text: KEY_PROBLEM[account.ai.keyProblem], red: true };
  if (account.limitsReached.ai) return { text: 'Daily limit reached', red: false };
  if (account.name?.trim()) return { text: account.email, red: false };
  return { text: `Signed up ${dayLabel(account.createdAt)}`, red: false };
}

/** "Today, 4:12 PM", "Nov 5", or a dash before the first visit. */
export const lastActiveLabel = (account: AdminAccount) =>
  account.lastActiveAt ? whenLabel(account.lastActiveAt) : '—';

/** The account page's grey line: "Signed up Nov 9 · last active today, 9:40 AM". */
export function accountCrumb(account: AdminAccount) {
  const parts = [`Signed up ${dayLabel(account.createdAt)}`];
  if (account.lastActiveAt) {
    const when = whenLabel(account.lastActiveAt);
    parts.push(`last active ${when.startsWith('Today') ? when.replace('Today', 'today') : when}`);
  }
  return parts.join(' · ');
}

export type FactTone = 'plain' | 'red';

/** The account page's facts as pills: Gmail, AI, limits, mails and applications. */
export function accountFacts(
  account: AdminAccount,
): { key: string; text: string; tone: FactTone }[] {
  const facts: { key: string; text: string; tone: FactTone }[] = [];
  if (account.suspension)
    facts.push({
      key: 'suspended',
      text: `Suspended ${dayLabel(account.suspension.suspendedAt)}`,
      tone: 'red',
    });
  if (account.testAccount) facts.push({ key: 'test', text: 'Test account', tone: 'plain' });
  const { state, lastSyncedAt } = account.gmail;
  if (state === 'SYNC_FAILING') facts.push({ key: 'gmail', text: 'Sync failing', tone: 'red' });
  else if (state === 'ACCESS_REMOVED')
    facts.push({ key: 'gmail', text: 'Gmail access removed', tone: 'red' });
  else if (state === 'NOT_CONNECTED')
    facts.push({ key: 'gmail', text: 'Gmail not connected', tone: 'plain' });
  else
    facts.push({
      key: 'gmail',
      text: lastSyncedAt ? `Gmail synced ${clock(lastSyncedAt)}` : 'Gmail connected',
      tone: 'plain',
    });
  facts.push({ key: 'ai', text: aiLabel(account) ?? 'AI not set up', tone: 'plain' });
  if (account.ai.keyProblem)
    facts.push({ key: 'key', text: KEY_PROBLEM[account.ai.keyProblem], tone: 'red' });
  if (account.limitsReached.ai) facts.push({ key: 'limit', text: 'Daily limit', tone: 'red' });
  if (account.limitsReached.replies)
    facts.push({ key: 'replies', text: 'Reply limit', tone: 'red' });
  facts.push({
    key: 'mails',
    text: `${count(account.mailsChecked30d)} mails · 30 days`,
    tone: 'plain',
  });
  facts.push({
    key: 'applications',
    text: `${count(account.applications)} ${account.applications === 1 ? 'application' : 'applications'}`,
    tone: 'plain',
  });
  return facts;
}

/** The Messages row's grey words: when the last one went out. */
export function lastSentLabel(sentAt: string | undefined) {
  if (!sentAt) return 'None yet';
  const when = whenLabel(sentAt);
  return `Last: ${when.startsWith('Today') ? 'today' : when}`;
}
